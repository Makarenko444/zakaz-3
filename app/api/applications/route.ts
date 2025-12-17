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
    const technicalCurator = searchParams.get('technical_curator')
    const search = searchParams.get('search')
    const applicationNumber = searchParams.get('application_number')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortDir = searchParams.get('sort_dir') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Валидация полей сортировки
    const allowedSortFields = ['application_number', 'created_at', 'status', 'customer_fullname', 'street_and_house']
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at'
    const validSortDir = sortDir === 'asc' || sortDir === 'desc' ? sortDir : 'desc'

    // Базовый запрос
    // После миграции 028: адреса теперь в zakaz_addresses
    // Добавляем подсчёт файлов для иконки скрепочки
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
        ),
        files_count:zakaz_files(count)
      `, { count: 'exact' })
      .order(validSortBy, { ascending: validSortDir === 'asc' })

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

    // Фильтр по техническому куратору
    if (technicalCurator) {
      if (technicalCurator === 'unassigned') {
        // Заявки без технического куратора
        query = query.is('technical_curator_id', null)
      } else {
        // Заявки с конкретным куратором
        query = query.eq('technical_curator_id', technicalCurator)
      }
    }

    // Поиск по ФИО, телефону и адресу
    if (search) {
      // Экранируем специальные символы для LIKE
      const escapedSearch = search.replace(/[%_]/g, '\\$&')
      // Для адресного поиска: заменяем пробелы на % для fuzzy matching
      // Это позволяет искать "герцена 68" и найти "Герцена, 68" или "ул. Герцена, д. 68"
      const addressSearchPattern = `%${escapedSearch.split(/\s+/).filter(Boolean).join('%')}%`
      const searchPattern = `%${escapedSearch}%`

      console.log('[Applications API] Search query:', search)
      console.log('[Applications API] Search pattern:', searchPattern)
      console.log('[Applications API] Address search pattern:', addressSearchPattern)

      // Поиск по основным полям (без customer_company, так как оно может быть NULL)
      // Для адресных полей используем специальный паттерн с заменёнными пробелами
      query = query.or(
        `customer_fullname.ilike.${searchPattern},` +
        `customer_phone.ilike.${searchPattern},` +
        `street_and_house.ilike.${addressSearchPattern},` +
        `address_details.ilike.${addressSearchPattern}`
      )

      console.log('[Applications API] Search conditions applied')
    }

    // Поиск по номеру заявки
    if (applicationNumber) {
      const appNum = parseInt(applicationNumber)
      if (!isNaN(appNum)) {
        query = query.eq('application_number', appNum)
      }
    }

    // Фильтр по дате создания (от)
    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00`)
    }

    // Фильтр по дате создания (до)
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59`)
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
      technicalCurator,
      search,
      applicationNumber,
      dateFrom,
      dateTo,
      sortBy: validSortBy,
      sortDir: validSortDir
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

    // Подготовка данных для вставки
    const applicationData = {
      address_id: body.address_id || null,
      city: body.city || 'Томск',
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
    const selector = (builder as { select: (cols: string) => unknown }).select('*') as unknown
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
