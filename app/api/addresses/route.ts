import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'
import { validateSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    // Получаем параметры фильтрации
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortField = searchParams.get('sort_field') || 'created_at'
    const sortDirection = searchParams.get('sort_direction') || 'desc'

    // Базовый запрос для получения адресов с узлами
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('zakaz_addresses') as any)
      .select(`
        *,
        zakaz_nodes(
          id,
          code,
          presence_type,
          status,
          node_type
        )
      `, { count: 'exact' })
      .order(sortField, { ascending: sortDirection === 'asc' })

    // Поиск по адресу
    if (search) {
      query = query.or(`city.ilike.%${search}%,street.ilike.%${search}%,house.ilike.%${search}%,address.ilike.%${search}%`)
    }

    // Пагинация
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching addresses:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Обрабатываем данные - добавляем количество узлов
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedData = data?.map((address: any) => {
      const nodes = address.zakaz_nodes || []

      return {
        ...address,
        node_count: nodes.length,
        // presence_status уже есть в адресе из БД
        // Убираем вложенный массив узлов из ответа для краткости
        zakaz_nodes: undefined,
      }
    }) || []

    return NextResponse.json({
      data: transformedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in GET /api/addresses:', error)
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
    const session = await validateSession(request)

    // Только админы могут создавать адреса
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can create addresses' },
        { status: 403 }
      )
    }

    // Валидация обязательных полей
    if (!body.street) {
      return NextResponse.json(
        { error: 'Street is required' },
        { status: 400 }
      )
    }

    const city = body.city || 'Томск'
    const street = body.street
    const house = body.house || null
    const building = body.building || null
    const comment = body.comment || null
    const presenceStatus = body.presence_status || 'not_present' // По умолчанию - не присутствуем

    // Валидация presence_status
    const validPresenceStatuses = ['has_node', 'has_ao', 'has_transit_cable', 'collecting_collective', 'not_present']
    if (!validPresenceStatuses.includes(presenceStatus)) {
      return NextResponse.json(
        { error: 'Invalid presence_status' },
        { status: 400 }
      )
    }

    // Проверяем, не существует ли уже такой адрес
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingAddress } = await (supabase.from('zakaz_addresses') as any)
      .select('id')
      .eq('city', city)
      .eq('street', street || '')
      .eq('house', house || '')
      .eq('building', building || '')
      .maybeSingle()

    if (existingAddress) {
      return NextResponse.json(
        { error: 'Address already exists' },
        { status: 400 }
      )
    }

    // Создаем новый адрес
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('zakaz_addresses') as any)
      .insert({
        city,
        street,
        house,
        building,
        comment,
        presence_status: presenceStatus,
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Error creating address:', error)
      return NextResponse.json(
        { error: error?.message || 'Failed to create address' },
        { status: 500 }
      )
    }

    // Логируем создание
    if (session?.user) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email,
        userName: session.user.full_name,
        actionType: 'create',
        entityType: 'other',
        entityId: data.id,
        description: `Created address ${data.address}`,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/addresses:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
