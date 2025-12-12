import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/material-templates/[id] - получить шаблон с позициями
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Получаем шаблон
    const { data: template, error: templateError } = await (supabase.from as any)('zakaz_material_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (templateError) {
      if (templateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
      }
      return NextResponse.json({ error: templateError.message }, { status: 500 })
    }

    // Получаем позиции шаблона
    const { data: items, error: itemsError } = await (supabase.from as any)('zakaz_material_template_items')
      .select('*')
      .eq('template_id', id)
      .order('sort_order', { ascending: true })

    if (itemsError) {
      console.error('Error fetching template items:', itemsError)
    }

    return NextResponse.json({
      template: {
        ...template,
        items: items || [],
      },
    })
  } catch (error) {
    console.error('Error in GET /api/material-templates/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/material-templates/[id] - обновить шаблон
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { name, description, is_active, sort_order } = body

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (is_active !== undefined) updateData.is_active = is_active
    if (sort_order !== undefined) updateData.sort_order = sort_order

    const { data: template, error } = await (supabase.from as any)('zakaz_material_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating material template:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error in PUT /api/material-templates/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/material-templates/[id] - удалить шаблон
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await (supabase.from as any)('zakaz_material_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting material template:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/material-templates/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
