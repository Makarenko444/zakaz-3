import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'
import { validateSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    // Получаем параметры фильтрации
    const id = searchParams.get('id') // Для загрузки конкретного адреса по ID
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortField = searchParams.get('sort_field') || 'created_at'
    const sortDirection = searchParams.get('sort_direction') || 'desc'

    // Если запрашивается конкретный адрес по ID
    if (id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('zakaz_addresses') as any)
        .select(`
          *,
          zakaz_nodes(
            id,
            code,
            presence_type,
            status,
            node_type
          ),
          zakaz_applications(
            id,
            status
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching address by ID:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (!data) {
        return NextResponse.json({ error: 'Address not found' }, { status: 404 })
      }

      // Статусы завершенных заявок
      const completedStatuses = ['installed', 'rejected', 'no_tech']
      const nodes = data.zakaz_nodes || []
      const applications = data.zakaz_applications || []

      const transformedData = {
        ...data,
        node_count: nodes.length,
        applications_total: applications.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        applications_active: applications.filter((app: any) => !completedStatuses.includes(app.status)).length,
        zakaz_nodes: undefined,
        zakaz_applications: undefined,
      }

      return NextResponse.json({
        data: [transformedData],
        pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
      })
    }

    // Базовый запрос для получения адресов с узлами и заявками
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
        ),
        zakaz_applications(
          id,
          status
        )
      `, { count: 'exact' })
      .order(sortField, { ascending: sortDirection === 'asc' })

    // Поиск по адресу
    if (search) {
      const searchTerm = search.trim()
      if (searchTerm) {
        // Разбиваем поисковый запрос на слова для более точного поиска
        const words = searchTerm.split(/\s+/).filter(w => w.length > 0)

        if (words.length === 1) {
          // Одно слово - ищем по всем полям через OR
          query = query.or(`city.ilike.%${words[0]}%,street.ilike.%${words[0]}%,house.ilike.%${words[0]}%,address.ilike.%${words[0]}%`)
        } else {
          // Несколько слов - ищем чтобы все слова присутствовали в полном адресе
          // Например: "Ленина 92" найдет "Томск, улица Ленина, 92"
          words.forEach(word => {
            query = query.ilike('address', `%${word}%`)
          })
        }
      }
    }

    // Пагинация
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching addresses:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Статусы завершенных заявок
    const completedStatuses = ['installed', 'rejected', 'no_tech']

    // Обрабатываем данные - добавляем количество узлов и статистику заявок
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedData = data?.map((address: any) => {
      const nodes = address.zakaz_nodes || []
      const applications = address.zakaz_applications || []

      // Подсчитываем активные и всего заявок
      const totalApplications = applications.length
      const activeApplications = applications.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (app: any) => !completedStatuses.includes(app.status)
      ).length

      return {
        ...address,
        node_count: nodes.length,
        applications_total: totalApplications,
        applications_active: activeApplications,
        // presence_status уже есть в адресе из БД
        // Убираем вложенные массивы из ответа для краткости
        zakaz_nodes: undefined,
        zakaz_applications: undefined,
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
        { error: `Адрес "${city}, ${street}${house ? ', ' + house : ''}${building ? ', ' + building : ''}" уже существует в базе данных` },
        { status: 409 }
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
      // Обрабатываем ошибку дубликата на случай гонки
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'Адрес с такими параметрами уже существует в базе данных' },
          { status: 409 }
        )
      }
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
