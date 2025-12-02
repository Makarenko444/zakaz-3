import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'
import { validateSession } from '@/lib/session'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const body = await request.json()
    const session = await validateSession(request)

    // Только админы могут редактировать адреса
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can edit addresses' },
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
    const presenceStatus = body.presence_status || 'not_present'
    const address = body.address || `${city}, ${street}${house ? ', ' + house : ''}${building ? ', ' + building : ''}`

    // Валидация presence_status
    const validPresenceStatuses = ['has_node', 'has_ao', 'has_transit_cable', 'collecting_collective', 'not_present']
    if (!validPresenceStatuses.includes(presenceStatus)) {
      return NextResponse.json(
        { error: 'Invalid presence_status' },
        { status: 400 }
      )
    }

    // Обновляем адрес
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('zakaz_addresses') as any)
      .update({
        city,
        street,
        house,
        building,
        address,
        comment,
        presence_status: presenceStatus,
      })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      console.error('Error updating address:', error)
      return NextResponse.json(
        { error: error?.message || 'Failed to update address' },
        { status: 500 }
      )
    }

    // Логируем изменение
    if (session?.user) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email,
        userName: session.user.full_name,
        actionType: 'update',
        entityType: 'other',
        entityId: data.id,
        description: `Updated address ${data.address}`,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PUT /api/addresses/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const session = await validateSession(request)

    // Только админы могут удалять адреса
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete addresses' },
        { status: 403 }
      )
    }

    // Проверяем, есть ли узлы на этом адресе
    const { data: nodes } = await supabase
      .from('zakaz_nodes')
      .select('id')
      .eq('address_id', id)
      .limit(1)

    if (nodes && nodes.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete address with existing nodes. Delete all nodes first.' },
        { status: 400 }
      )
    }

    // Получаем данные адреса для логирования
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: addressData } = await (supabase.from('zakaz_addresses') as any)
      .select('address')
      .eq('id', id)
      .single()

    // Удаляем адрес
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('zakaz_addresses') as any)
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting address:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to delete address' },
        { status: 500 }
      )
    }

    // Логируем удаление
    if (session?.user) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email,
        userName: session.user.full_name,
        actionType: 'delete',
        entityType: 'other',
        entityId: id,
        description: `Deleted address ${addressData?.address || id}`,
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      })
    }

    return NextResponse.json({ message: 'Address deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/addresses/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
