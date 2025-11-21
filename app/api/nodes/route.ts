import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent, getUserData } from '@/lib/audit-log'

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

    // Базовый запрос
    let query = supabase
      .from('zakaz_nodes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

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
    const userData = await getUserData(request)

    // Валидация обязательных полей
    if (!body.code || !body.address) {
      return NextResponse.json(
        { error: 'Code and address are required' },
        { status: 400 }
      )
    }

    // Проверяем уникальность кода
    const { data: existingNode } = await supabase
      .from('zakaz_nodes')
      .select('id')
      .eq('code', body.code)
      .single()

    if (existingNode) {
      return NextResponse.json(
        { error: `Node with code ${body.code} already exists` },
        { status: 409 }
      )
    }

    // Создаем узел
    const { data, error } = await supabase
      .from('zakaz_nodes')
      .insert({
        code: body.code,
        address: body.address,
        location_details: body.location_details || null,
        comm_info: body.comm_info || null,
        status: body.status || 'existing',
        contract_link: body.contract_link || null,
        node_created_date: body.node_created_date || null,
        created_by: userData?.userId || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating node:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Логируем создание
    await logAudit({
      userId: userData?.userId || null,
      action: 'node.create',
      resourceType: 'node',
      resourceId: data.id,
      details: { code: data.code },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/nodes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
