import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'

export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    // Получаем параметры фильтрации
    const status = searchParams.get('status')
    const urgency = searchParams.get('urgency')
    const serviceType = searchParams.get('service_type')
    const customerType = searchParams.get('customer_type')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') === 'asc' ? 'asc' : 'desc'

    const sortableColumns: Record<string, string> = {
      created_at: 'created_at',
      application_number: 'application_number',
      status: 'status',
      urgency: 'urgency',
      customer_fullname: 'customer_fullname',
    }

    const orderColumn = sortableColumns[sortBy] || 'created_at'
    const isAscending = sortOrder === 'asc'

    // Базовый запрос
    let query = supabase
      .from('zakaz_applications')
      .select('*, zakaz_addresses(street, house, entrance)', { count: 'exact' })

    // Применяем фильтры
    if (status) {
      const statuses = status.split(',')
      query = query.in('status', statuses)
    }

    if (urgency) {
      const urgencies = urgency.split(',')
      query = query.in('urgency', urgencies)
    }

    if (serviceType) {
      query = query.eq('service_type', serviceType)
    }

    if (customerType) {
      query = query.eq('customer_type', customerType)
    }

    // Поиск по имени или телефону
    if (search) {
      query = query.or(`customer_fullname.ilike.%${search}%,customer_phone.ilike.%${search}%`)
    }

    // Сортировка
    query = query.order(orderColumn, { ascending: isAscending })

    // Пагинация
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch applications', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      applications: data || [],
      total: count || 0,
      page,
      limit,
      pages: count ? Math.ceil(count / limit) : 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const body = await request.json()

    // Валидация обязательных полей
    const requiredFields = [
      'address_id',
      'customer_type',
      'service_type',
      'customer_fullname',
      'customer_phone',
      'urgency'
    ]

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Field '${field}' is required` },
          { status: 400 }
        )
      }
    }

    // Для юр.лиц обязательны контактные данные
    if (body.customer_type === 'business') {
      if (!body.contact_person || !body.contact_phone) {
        return NextResponse.json(
          { error: 'Contact person and phone are required for business customers' },
          { status: 400 }
        )
      }
    }

    // Подготовка данных для вставки
    const applicationData = {
      address_id: body.address_id,
      customer_type: body.customer_type,
      service_type: body.service_type,
      customer_fullname: body.customer_fullname,
      customer_phone: body.customer_phone,
      contact_person: body.contact_person || null,
      contact_phone: body.contact_phone || null,
      urgency: body.urgency || 'normal',
      status: 'new', // Всегда создаём со статусом "new"
      client_comment: body.client_comment || null,
      assigned_to: body.assigned_to || null,
      created_by: body.created_by || null,
    }

    // Обходим проблемы с автогенерируемыми типами Supabase через unknown
    const table = supabase.from('zakaz_applications') as unknown
    const builder = (table as { insert: (data: Record<string, unknown>) => unknown }).insert(applicationData) as unknown
    const selector = (builder as { select: (cols: string) => unknown }).select('*, zakaz_addresses(street, house, entrance)') as unknown
    const query = (selector as { single: () => Promise<unknown> }).single()
    const result = await query
    const { data, error } = result as { data: { id: string; application_number: string; [key: string]: unknown } | null; error: { message?: string; [key: string]: unknown } | null }

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create application', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      console.error('No data returned from insert')
      return NextResponse.json(
        { error: 'Failed to create application' },
        { status: 500 }
      )
    }

    // Логируем создание заявки
    await logAudit({
      userId: body.created_by || undefined,
      actionType: 'create',
      entityType: 'application',
      entityId: data.id,
      description: `Создана новая заявка №${data.application_number}: ${body.customer_fullname}`,
      newValues: {
        customer_fullname: body.customer_fullname,
        customer_phone: body.customer_phone,
        service_type: body.service_type,
        urgency: body.urgency,
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json(
      { application: data, message: 'Application created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
