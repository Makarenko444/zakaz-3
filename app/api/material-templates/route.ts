import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET /api/material-templates - список шаблонов
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: templates, error } = await (supabase.from as any)('zakaz_material_templates')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching material templates:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error in GET /api/material-templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/material-templates - создание шаблона
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
    }

    // Получаем максимальный sort_order
    const { data: maxSort } = await (supabase.from as any)('zakaz_material_templates')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxSort?.sort_order || 0) + 1

    const { data: template, error } = await (supabase.from as any)('zakaz_material_templates')
      .insert({
        name,
        description: description || null,
        sort_order: nextSortOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating material template:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/material-templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
