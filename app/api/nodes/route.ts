import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'
import { validateSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    // Получаем параметры фильтрации
    const status = searchParams.get('status')
    const nodeType = searchParams.get('node_type')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortField = searchParams.get('sort_field') || 'created_at'
    const sortDirection = searchParams.get('sort_direction') || 'desc'

    // Базовый запрос
    let query = supabase
      .from('zakaz_nodes')
      .select('*', { count: 'exact' })
      .order(sortField, { ascending: sortDirection === 'asc' })

    // Применяем фильтры
    if (status) {
      query = query.eq('status', status)
    }

    if (nodeType) {
      query = query.eq('node_type', nodeType)
    }

    // Поиск по коду, адресу или описанию
    if (search) {
      query = query.or(`code.ilike.%${search}%,address.ilike.%${search}%,location_details.ilike.%${search}%`)
    }

    // Пагинация
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching nodes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in GET /api/nodes:', error)
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

    // Валидация обязательных полей
    if (!body.street) {
      return NextResponse.json(
        { error: 'Street is required' },
        { status: 400 }
      )
    }

    // Генерируем code если не передан
    let code = body.code
    if (!code || code.trim() === '') {
      // Генерируем код на основе адреса
      const streetPart = body.street.substring(0, 3).toUpperCase()
      const housePart = body.house ? body.house.replace(/\D/g, '').substring(0, 3) : '000'
      const timestamp = Date.now().toString().slice(-4)
      code = `${streetPart}${housePart}${timestamp}`
    }

    // Создаем узел
    // Поле address будет автоматически сформировано триггером в БД
    const table = supabase.from('zakaz_nodes') as unknown
    const result = await (table as { insert: (data: unknown) => { select: () => { single: () => Promise<unknown> } } })
      .insert({
        code: code,
        city: body.city || 'Томск',
        street: body.street,
        house: body.house || null,
        building: body.building || null,
        location_details: body.location_details || null,
        comm_info: body.comm_info || null,
        status: body.status || 'existing',
        contract_link: body.contract_link || null,
        node_created_date: body.node_created_date || null,
        created_by: session?.user?.id || null,
      })
      .select()
      .single()
    const { data, error } = result as { data: { id: string; code: string } | null; error: { message: string } | null }

    if (error || !data) {
      console.error('Error creating node:', error)
      return NextResponse.json({ error: error?.message || 'Failed to create node' }, { status: 500 })
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
        description: `Created node ${data.code}`,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/nodes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
