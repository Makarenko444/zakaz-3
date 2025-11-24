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
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { city, street, house, building, comment, presence_type } = body

    const supabase = createDirectClient()

    const updateData: Record<string, unknown> = {}
    if (city !== undefined) updateData.city = city
    if (street !== undefined) updateData.street = street
    if (house !== undefined) updateData.house = house
    if (building !== undefined) updateData.building = building || null
    if (comment !== undefined) updateData.comment = comment || null
    if (presence_type !== undefined) updateData.presence_type = presence_type
    // address будет автоматически обновлен триггером в БД

    const table = supabase.from('zakaz_nodes') as unknown
    const updateBuilder = (table as { update: (data: Record<string, unknown>) => unknown }).update(updateData) as unknown
    const eqBuilder = (updateBuilder as { eq: (col: string, val: string) => unknown }).eq('id', id) as unknown
    const selectBuilder = (eqBuilder as { select: () => unknown }).select() as unknown
    const result = await (selectBuilder as { single: () => Promise<unknown> }).single()
    const { data, error } = result as { data: unknown; error: unknown }

    if (error) {
      console.error('Error updating address:', error)
      return NextResponse.json({ error: 'Не удалось обновить адрес' }, { status: 500 })
    }

    return NextResponse.json({ address: data })
  } catch (error) {
    console.error('Error in admin addresses PATCH:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
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
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 401 })
    }

    const { id } = await context.params
    const supabase = createDirectClient()

    // Проверяем, используется ли узел/адрес в заявках
    const { count } = await supabase
      .from('zakaz_applications')
      .select('id', { count: 'exact', head: true })
      .eq('node_id', id)

    if (count && count > 0) {
      const applicationsText = count === 1 ? 'заявке' : count > 1 && count < 5 ? 'заявках' : 'заявках'
      return NextResponse.json(
        { error: `Невозможно удалить узел/адрес. Он используется в ${count} ${applicationsText}` },
        { status: 400 }
      )
    }

    // Удаляем узел/адрес
    const { error } = await supabase
      .from('zakaz_nodes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting address:', error)
      return NextResponse.json({ error: 'Не удалось удалить адрес' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in admin addresses DELETE:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
