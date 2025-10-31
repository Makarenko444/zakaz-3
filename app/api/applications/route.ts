import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
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
