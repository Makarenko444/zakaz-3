import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'

// PATCH - обновить адрес
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { street, house, entrance, comment } = body

    const supabase = createDirectClient()

    const updateData: Record<string, unknown> = {}
    if (street !== undefined) updateData.street = street
    if (house !== undefined) updateData.house = house
    if (entrance !== undefined) updateData.entrance = entrance || null
    if (comment !== undefined) updateData.comment = comment || null

    const table = supabase.from('zakaz_addresses') as unknown
    const updateBuilder = (table as { update: (data: Record<string, unknown>) => unknown }).update(updateData) as unknown
    const eqBuilder = (updateBuilder as { eq: (col: string, val: string) => unknown }).eq('id', id) as unknown
    const selectBuilder = (eqBuilder as { select: () => unknown }).select() as unknown
    const result = await (selectBuilder as { single: () => Promise<unknown> }).single()
    const { data, error } = result as { data: unknown; error: unknown }

    if (error) {
      console.error('Error updating address:', error)
      return NextResponse.json({ error: 'Failed to update address' }, { status: 500 })
    }

    return NextResponse.json({ address: data })
  } catch (error) {
    console.error('Error in admin addresses PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - удалить адрес
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const supabase = createDirectClient()

    // Проверяем, используется ли адрес в заявках
    const { count } = await supabase
      .from('zakaz_applications')
      .select('id', { count: 'exact', head: true })
      .eq('address_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete address. It is used in ${count} application(s)` },
        { status: 400 }
      )
    }

    // Удаляем адрес
    const { error } = await supabase
      .from('zakaz_addresses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting address:', error)
      return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in admin addresses DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
