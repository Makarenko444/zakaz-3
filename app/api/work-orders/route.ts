import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent, getUserData } from '@/lib/audit-log'
import { WorkOrderType, WorkOrderStatus } from '@/lib/types'

// GET /api/work-orders - список нарядов с фильтрами
export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    // Параметры фильтрации
    const applicationId = searchParams.get('application_id')
    const type = searchParams.get('type') as WorkOrderType | null
    const status = searchParams.get('status')
    const executorId = searchParams.get('executor_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const scheduledDate = searchParams.get('scheduled_date')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortDir = searchParams.get('sort_dir') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Валидация полей сортировки
    const allowedSortFields = ['work_order_number', 'created_at', 'scheduled_date', 'status', 'type']
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at'
    const validSortDir = sortDir === 'asc' || sortDir === 'desc' ? sortDir : 'desc'

    // Базовый запрос с join на заявку и исполнителей
    let query = supabase
      .from('zakaz_work_orders')
      .select(`
        *,
        application:zakaz_applications(
          id,
          application_number,
          customer_fullname,
          customer_phone,
          city,
          street_and_house,
          address_details,
          service_type
        ),
        executors:zakaz_work_order_executors(
          id,
          user_id,
          is_lead,
          user:zakaz_users(id, full_name, email, phone, role)
        )
      `, { count: 'exact' })
      .order(validSortBy, { ascending: validSortDir === 'asc' })

    // Фильтр по заявке
    if (applicationId) {
      query = query.eq('application_id', applicationId)
    }

    // Фильтр по типу наряда
    if (type) {
      query = query.eq('type', type)
    }

    // Фильтр по статусу (может быть несколько через запятую)
    if (status) {
      const statuses = status.split(',')
      query = query.in('status', statuses)
    }

    // Фильтр по исполнителю - через подзапрос
    if (executorId) {
      // Получаем ID нарядов где есть этот исполнитель
      const { data: executorWorkOrders } = await supabase
        .from('zakaz_work_order_executors')
        .select('work_order_id')
        .eq('user_id', executorId)

      if (executorWorkOrders && executorWorkOrders.length > 0) {
        const workOrderIds = executorWorkOrders.map(e => e.work_order_id)
        query = query.in('id', workOrderIds)
      } else {
        // Нет нарядов с этим исполнителем
        return NextResponse.json({
          work_orders: [],
          total: 0,
          page,
          limit,
          pages: 0,
        })
      }
    }

    // Фильтр по конкретной дате
    if (scheduledDate) {
      query = query.eq('scheduled_date', scheduledDate)
    }

    // Фильтр по диапазону дат
    if (dateFrom) {
      query = query.gte('scheduled_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('scheduled_date', dateTo)
    }

    // Пагинация
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch work orders', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      work_orders: data || [],
      total: count || 0,
      page,
      limit,
      pages: count ? Math.ceil(count / limit) : 0,
    })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/work-orders - создание наряда
export async function POST(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const body = await request.json()

    // Валидация обязательных полей
    if (!body.application_id) {
      return NextResponse.json(
        { error: 'Field "application_id" is required' },
        { status: 400 }
      )
    }

    if (!body.type || !['survey', 'installation'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Field "type" must be "survey" or "installation"' },
        { status: 400 }
      )
    }

    // Проверяем существование заявки
    const { data: application, error: appError } = await supabase
      .from('zakaz_applications')
      .select('id, application_number, customer_fullname')
      .eq('id', body.application_id)
      .single()

    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Подготовка данных для вставки
    const workOrderData = {
      application_id: body.application_id,
      type: body.type as WorkOrderType,
      status: (body.status as WorkOrderStatus) || 'draft',
      scheduled_date: body.scheduled_date || null,
      scheduled_time: body.scheduled_time || null,
      estimated_duration: body.estimated_duration || null,
      notes: body.notes || null,
      created_by: body.created_by || null,
      updated_by: body.created_by || null,
    }

    const { data, error } = await supabase
      .from('zakaz_work_orders')
      .insert(workOrderData)
      .select('*')
      .single()

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create work order', details: error.message },
        { status: 500 }
      )
    }

    // Добавляем исполнителей если переданы
    if (body.executors && Array.isArray(body.executors) && body.executors.length > 0) {
      const executorsData = body.executors.map((exec: { user_id: string; is_lead?: boolean }) => ({
        work_order_id: data.id,
        user_id: exec.user_id,
        is_lead: exec.is_lead || false,
      }))

      const { error: execError } = await supabase
        .from('zakaz_work_order_executors')
        .insert(executorsData)

      if (execError) {
        console.error('[WorkOrders API] Error adding executors:', execError)
      }
    }

    // Записываем в историю статусов
    await supabase
      .from('zakaz_work_order_status_history')
      .insert({
        work_order_id: data.id,
        old_status: null,
        new_status: data.status,
        changed_by: body.created_by || null,
        comment: 'Наряд создан',
      })

    // Логируем создание
    const userData = await getUserData(body.created_by)
    const typeLabel = body.type === 'survey' ? 'Осмотр и расчёт' : 'Монтаж'

    await logAudit({
      ...userData,
      actionType: 'create',
      entityType: 'work_order',
      entityId: data.id,
      description: `Создан наряд №${data.work_order_number} (${typeLabel}) для заявки №${application.application_number}`,
      newValues: {
        type: body.type,
        scheduled_date: body.scheduled_date,
        application_id: body.application_id,
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json(
      { work_order: data, message: 'Work order created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
