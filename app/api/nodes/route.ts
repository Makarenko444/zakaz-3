import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'
import { validateSession } from '@/lib/session'
import type { Address } from '@/lib/types'

interface NodeWithAddress {
  id: string
  code: string
  address_id?: string
  node_type: string
  presence_type: string
  location_details: string | null
  comm_info: string | null
  status: string
  contract_link: string | null
  node_created_date: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
  address?: Address | null
}

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

    // Базовый запрос с JOIN на zakaz_addresses
    // Используем left join т.к. address_id может быть опциональным во время миграции
    let query = supabase
      .from('zakaz_nodes')
      .select(`
        *,
        address:zakaz_addresses!address_id(
          id,
          city,
          street,
          house,
          building,
          address,
          comment
        )
      `, { count: 'exact' })
      .order(sortField, { ascending: sortDirection === 'asc' })

    // Применяем фильтры
    if (status) {
      query = query.eq('status', status)
    }

    if (nodeType) {
      query = query.eq('node_type', nodeType)
    }

    // Поиск по коду, адресу или описанию
    // После миграции 028 поиск по адресу нужно делать через JOIN
    if (search) {
      // Для поиска по адресу нужен более сложный запрос, но пока используем только code и location_details
      query = query.or(`code.ilike.%${search}%,location_details.ilike.%${search}%`)
    }

    // Пагинация
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching nodes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Преобразуем данные - расплющиваем объект address в корневой уровень для обратной совместимости
    const transformedData = data?.map((node: NodeWithAddress) => ({
      ...node,
      // Если есть вложенный address, добавляем его поля в корень для обратной совместимости
      ...(node.address && {
        city: node.address.city,
        street: node.address.street,
        house: node.address.house,
        building: node.address.building,
        address: node.address.address,
        comment: node.address.comment,
      }),
    })) || []

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

    const city = body.city || 'Томск'
    const street = body.street
    const house = body.house || null
    const building = body.building || null
    const comment = body.comment || null

    // Шаг 1: Создаем или находим адрес в zakaz_addresses
    let addressId: string | null = null

    // Пытаемся найти существующий адрес
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingAddress } = await (supabase.from('zakaz_addresses') as any)
      .select('id')
      .eq('city', city)
      .eq('street', street || '')
      .eq('house', house || '')
      .eq('building', building || '')
      .maybeSingle()

    if (existingAddress) {
      // Адрес уже существует
      addressId = existingAddress.id
    } else {
      // Создаем новый адрес
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newAddress, error: addressError } = await (supabase.from('zakaz_addresses') as any)
        .insert({
          city,
          street,
          house,
          building,
          comment,
        })
        .select('id')
        .single()

      if (addressError || !newAddress) {
        console.error('Error creating address:', addressError)
        return NextResponse.json(
          { error: addressError?.message || 'Failed to create address' },
          { status: 500 }
        )
      }

      addressId = newAddress.id
    }

    // Генерируем code если не передан
    let code = body.code
    if (!code || code.trim() === '') {
      // Генерируем код на основе адреса
      const streetPart = street.substring(0, 3).toUpperCase()
      const housePart = house ? house.replace(/\D/g, '').substring(0, 3) : '000'
      const timestamp = Date.now().toString().slice(-4)
      code = `${streetPart}${housePart}${timestamp}`
    }

    // Шаг 2: Создаем узел с ссылкой на адрес
    const { data, error } = await supabase
      .from('zakaz_nodes')
      .insert({
        code: code,
        address_id: addressId,
        location_details: body.location_details || null,
        comm_info: body.comm_info || null,
        status: body.status || 'existing',
        contract_link: body.contract_link || null,
        node_created_date: body.node_created_date || null,
        created_by: session?.user?.id || null,
      })
      .select()
      .single()

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
