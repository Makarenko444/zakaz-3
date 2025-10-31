import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

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

    // Базовый запрос
    let query = supabase
      .from('zakaz_applications')
      .select('*, zakaz_addresses(street, house, entrance)', { count: 'exact' })
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

    // Поиск по имени или телефону
    if (search) {
      query = query.or(`customer_fullname.ilike.%${search}%,customer_phone.ilike.%${search}%`)
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

    const { data, error } = await supabase
      .from('zakaz_applications')
      .insert(applicationData)
      .select('*, zakaz_addresses(street, house, entrance)')
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create application', details: error.message },
        { status: 500 }
      )
    }

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
