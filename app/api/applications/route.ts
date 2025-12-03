import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent, getUserData } from '@/lib/audit-log'

export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    // Получаем параметры фильтрации
    const status = searchParams.get('status')
    const urgency = searchParams.get('urgency')
    const serviceType = searchParams.get('service_type')
    const customerType = searchParams.get('customer_type')
    const nodeId = searchParams.get('node_id')
    const addressId = searchParams.get('address_id')
    const assignedTo = searchParams.get('assigned_to')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Базовый запрос
    // После миграции 028: адреса теперь в zakaz_addresses
    let query = supabase
      .from('zakaz_applications')
      .select(`
        *,
        zakaz_nodes(
          id,
          code,
          presence_type,
          address:zakaz_addresses!address_id(
            id,
            city,
            street,
            house,
            building,
            address
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

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

    if (nodeId) {
      query = query.eq('node_id', nodeId)
    }

    // Фильтр по формализованному адресу
    if (addressId) {
      query = query.eq('address_id', addressId)
    }

    // Фильтр по назначенному менеджеру
    if (assignedTo) {
      if (assignedTo === 'unassigned') {
        // Заявки без назначенного менеджера
        query = query.is('assigned_to', null)
      } else {
        // Заявки с конкретным менеджером
        query = query.eq('assigned_to', assignedTo)
      }
    }

    // Поиск по ФИО, телефону и адресу
    if (search) {
      // Экранируем специальные символы для LIKE
      const escapedSearch = search.replace(/[%_]/g, '\\$&')
      const searchPattern = `%${escapedSearch}%`

      console.log('[Applications API] Search query:', search)
      console.log('[Applications API] Escaped pattern:', searchPattern)

      // Поиск по основным полям (без customer_company, так как оно может быть NULL)
      query = query.or(
        `customer_fullname.ilike.${searchPattern},` +
        `customer_phone.ilike.${searchPattern},` +
        `street_and_house.ilike.${searchPattern}`
      )

      console.log('[Applications API] Search conditions applied')
    }

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

    console.log('[Applications API] Found', count, 'applications with filters:', {
      status,
      urgency,
      serviceType,
      customerType,
      nodeId,
      assignedTo,
      search
    })

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
      'customer_type',
      'service_type',
      'customer_fullname',
      'customer_phone',
      'urgency',
      'street_and_house'
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
      address_id: body.address_id || null,
      street_and_house: body.street_and_house,
      address_details: body.address_details || null,
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
    const selector = (builder as { select: (cols: string) => unknown }).select('*, zakaz_addresses!address_id(id, city, street, house, building, address, comment)') as unknown
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
    // Получаем данные пользователя для аудита
    const userData = await getUserData(body.created_by)

    await logAudit({
      ...userData,
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
