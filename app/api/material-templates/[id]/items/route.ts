import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/* eslint-disable @typescript-eslint/no-explicit-any */

// POST /api/material-templates/[id]/items - добавить позицию в шаблон
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: template_id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { material_id, material_name, unit, quantity, notes } = body

    if (!material_name) {
      return NextResponse.json({ error: 'Название материала обязательно' }, { status: 400 })
    }

    // Получаем максимальный sort_order для этого шаблона
    const { data: maxSort } = await (supabase.from as any)('zakaz_material_template_items')
      .select('sort_order')
      .eq('template_id', template_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxSort?.sort_order || 0) + 1

    const { data: item, error } = await (supabase.from as any)('zakaz_material_template_items')
      .insert({
        template_id,
        material_id: material_id || null,
        material_name,
        unit: unit || 'шт',
        quantity: quantity !== undefined ? quantity : null,
        notes: notes || null,
        sort_order: nextSortOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding item to template:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/material-templates/[id]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/material-templates/[id]/items?item_id=xxx - удалить позицию из шаблона
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: template_id } = await params
    const { searchParams } = new URL(request.url)
    const item_id = searchParams.get('item_id')

    if (!item_id) {
      return NextResponse.json({ error: 'item_id обязателен' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await (supabase.from as any)('zakaz_material_template_items')
      .delete()
      .eq('id', item_id)
      .eq('template_id', template_id)

    if (error) {
      console.error('Error deleting item from template:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/material-templates/[id]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/material-templates/[id]/items - обновить позицию
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: template_id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { item_id, material_name, unit, quantity, notes, sort_order } = body

    if (!item_id) {
      return NextResponse.json({ error: 'item_id обязателен' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (material_name !== undefined) updateData.material_name = material_name
    if (unit !== undefined) updateData.unit = unit
    if (quantity !== undefined) updateData.quantity = quantity
    if (notes !== undefined) updateData.notes = notes
    if (sort_order !== undefined) updateData.sort_order = sort_order

    const { data: item, error } = await (supabase.from as any)('zakaz_material_template_items')
      .update(updateData)
      .eq('id', item_id)
      .eq('template_id', template_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating template item:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error in PATCH /api/material-templates/[id]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
