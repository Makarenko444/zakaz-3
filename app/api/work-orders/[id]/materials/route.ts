import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

// Таблицы zakaz_work_orders и zakaz_work_order_materials еще не в сгенерированных типах Supabase

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/work-orders/[id]/materials - список материалов наряда
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()

    // Проверяем существование наряда
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workOrder, error: woError } = await (supabase.from as any)('zakaz_work_orders')
      .select('id')
      .eq('id', id)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('zakaz_work_order_materials')
      .select('*')
      .eq('work_order_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch materials', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ materials: data || [] })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/work-orders/[id]/materials - добавление материала
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const body = await request.json()

    const { material_id, material_name, unit, quantity, notes } = body

    // Валидация
    if (!material_name) {
      return NextResponse.json(
        { error: 'Field "material_name" is required' },
        { status: 400 }
      )
    }

    if (!unit) {
      return NextResponse.json(
        { error: 'Field "unit" is required' },
        { status: 400 }
      )
    }

    // Проверяем существование наряда
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workOrder, error: woError } = await (supabase.from as any)('zakaz_work_orders')
      .select('id')
      .eq('id', id)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // Добавляем материал
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('zakaz_work_order_materials')
      .insert({
        work_order_id: id,
        material_id: material_id || null,
        material_name,
        unit,
        quantity: quantity || 0,
        notes: notes || null,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to add material', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { material: data, message: 'Material added successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/work-orders/[id]/materials - массовое обновление материалов
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const body = await request.json()

    const { materials } = body

    if (!Array.isArray(materials)) {
      return NextResponse.json(
        { error: 'Field "materials" must be an array' },
        { status: 400 }
      )
    }

    // Проверяем существование наряда
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workOrder, error: woError } = await (supabase.from as any)('zakaz_work_orders')
      .select('id')
      .eq('id', id)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // Удаляем старые материалы
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from as any)('zakaz_work_order_materials')
      .delete()
      .eq('work_order_id', id)

    // Добавляем новые
    if (materials.length > 0) {
      const materialsData = materials.map((m: {
        material_id?: string
        material_name: string
        unit: string
        quantity?: number
        notes?: string
      }) => ({
        work_order_id: id,
        material_id: m.material_id || null,
        material_name: m.material_name,
        unit: m.unit,
        quantity: m.quantity || 0,
        notes: m.notes || null,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)('zakaz_work_order_materials')
        .insert(materialsData)

      if (error) {
        console.error('[WorkOrders API] Database error:', error)
        return NextResponse.json(
          { error: 'Failed to update materials', details: error.message },
          { status: 500 }
        )
      }
    }

    // Получаем обновлённый список
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from as any)('zakaz_work_order_materials')
      .select('*')
      .eq('work_order_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      materials: data || [],
      message: 'Materials updated successfully',
    })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/work-orders/[id]/materials - обновление одного материала
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const body = await request.json()

    const { material_record_id, quantity, notes } = body

    if (!material_record_id) {
      return NextResponse.json(
        { error: 'Field "material_record_id" is required' },
        { status: 400 }
      )
    }

    // Проверяем существование записи
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase.from as any)('zakaz_work_order_materials')
      .select('id')
      .eq('id', material_record_id)
      .eq('work_order_id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Material record not found' },
        { status: 404 }
      )
    }

    // Обновляем
    const updateData: Record<string, unknown> = {}
    if (quantity !== undefined) updateData.quantity = quantity
    if (notes !== undefined) updateData.notes = notes

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('zakaz_work_order_materials')
      .update(updateData)
      .eq('id', material_record_id)
      .select('*')
      .single()

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update material', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      material: data,
      message: 'Material updated successfully',
    })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/work-orders/[id]/materials?material_record_id=xxx - удаление материала
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams
    const materialRecordId = searchParams.get('material_record_id')

    if (!materialRecordId) {
      return NextResponse.json(
        { error: 'Query parameter "material_record_id" is required' },
        { status: 400 }
      )
    }

    // Проверяем существование
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase.from as any)('zakaz_work_order_materials')
      .select('id')
      .eq('id', materialRecordId)
      .eq('work_order_id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Material record not found' },
        { status: 404 }
      )
    }

    // Удаляем
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)('zakaz_work_order_materials')
      .delete()
      .eq('id', materialRecordId)

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete material', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Material removed successfully',
    })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
