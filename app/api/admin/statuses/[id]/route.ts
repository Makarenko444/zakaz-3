import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'

// PATCH - обновить статус
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
    const { code, name_ru, description_ru, sort_order, is_active } = body

    const supabase = createDirectClient()

    const updateData: Record<string, unknown> = {}
    if (code !== undefined) updateData.code = code
    if (name_ru !== undefined) updateData.name_ru = name_ru
    if (description_ru !== undefined) updateData.description_ru = description_ru || null
    if (sort_order !== undefined) updateData.sort_order = sort_order
    if (is_active !== undefined) updateData.is_active = is_active

    const { data, error } = await supabase
      .from('zakaz_application_statuses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating status:', error)
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({ status: data })
  } catch (error) {
    console.error('Error in admin statuses PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - удалить статус (деактивация)
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

    // Деактивируем статус вместо удаления
    const { data, error } = await supabase
      .from('zakaz_application_statuses')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error deleting status:', error)
      return NextResponse.json({ error: 'Failed to delete status' }, { status: 500 })
    }

    return NextResponse.json({ status: data })
  } catch (error) {
    console.error('Error in admin statuses DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
