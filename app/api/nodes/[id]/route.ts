import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'
import { validateSession } from '@/lib/session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id } = await params

    const { data, error } = await supabase
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
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Node not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching node:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Преобразуем данные - расплющиваем address
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeData = data as any
    const transformedNode = {
      ...nodeData,
      ...(nodeData.address && {
        city: nodeData.address.city,
        street: nodeData.address.street,
        house: nodeData.address.house,
        building: nodeData.address.building,
        address: nodeData.address.address,
        comment: nodeData.address.comment,
      }),
    }

    return NextResponse.json(transformedNode)
  } catch (error) {
    console.error('Error in GET /api/nodes/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const session = await validateSession(request)

    // Только админы могут редактировать узлы
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can edit nodes' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Если изменяются поля адреса, обновляем address_id
    let addressId = body.address_id

    if (body.city || body.street || body.house || body.building !== undefined) {
      const city = body.city || 'Томск'
      const street = body.street || null
      const house = body.house || null
      const building = body.building || null
      const comment = body.comment || null

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
    }

    // Обновляем узел
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('zakaz_nodes') as any)
      .update({
        code: body.code,
        node_type: body.node_type,
        address_id: addressId,
        location_details: body.location_details,
        comm_info: body.comm_info,
        status: body.status,
        contract_link: body.contract_link,
        node_created_date: body.node_created_date,
        updated_by: session.user.id,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating node:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Логируем обновление
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.full_name,
      actionType: 'update',
      entityType: 'other',
      entityId: id,
      description: `Updated node ${body.code}`,
      newValues: body,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PUT /api/nodes/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
