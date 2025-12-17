import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { Material } from '@/lib/types'

// Таблица zakaz_materials еще не в сгенерированных типах Supabase,
// поэтому используем приведение типов

// GET /api/materials - список материалов из справочника
export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    const category = searchParams.get('category')
    const activeOnly = searchParams.get('active_only') !== 'false' // по умолчанию только активные
    const search = searchParams.get('search')

    const activityLevel = searchParams.get('activity_level')
    const maxActivityLevel = searchParams.get('max_activity_level')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from as any)('zakaz_materials')
      .select('*')
      .order('activity_level', { ascending: true }) // Сначала популярные (1), потом архивные (4)
      .order('name', { ascending: true })

    // Фильтр по уровню активности
    if (activityLevel) {
      query = query.eq('activity_level', parseInt(activityLevel))
    } else if (maxActivityLevel) {
      // Показывать материалы до определённого уровня (например, 1-3 без архивных)
      query = query.lte('activity_level', parseInt(maxActivityLevel))
    }

    // Фильтр по активности (для обратной совместимости)
    if (activeOnly) {
      query = query.lte('activity_level', 3) // Не показывать архивные (4)
    }

    // Фильтр по категории
    if (category) {
      query = query.eq('category', category)
    }

    // Поиск по названию
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const result = await query
    const data = result.data as Material[] | null
    const error = result.error

    if (error) {
      console.error('[Materials API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch materials', details: error.message },
        { status: 500 }
      )
    }

    // Получаем суммы остатков по всем складам для каждого материала
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stocksData } = await (supabase.from as any)('zakaz_warehouse_stocks')
      .select('material_id, quantity')

    // Группируем остатки по material_id и суммируем
    const stocksByMaterial = new Map<string, number>()
    if (stocksData) {
      for (const stock of stocksData) {
        const current = stocksByMaterial.get(stock.material_id) || 0
        stocksByMaterial.set(stock.material_id, current + (stock.quantity || 0))
      }
    }

    // Добавляем stock_quantity к каждому материалу
    const materialsWithStock = (data || []).map(m => ({
      ...m,
      stock_quantity: stocksByMaterial.get(m.id) || 0,
    }))

    // Получаем уникальные категории
    const categories = [...new Set(data?.map(m => m.category).filter(Boolean) || [])]

    return NextResponse.json({
      materials: materialsWithStock,
      categories,
    })
  } catch (error) {
    console.error('[Materials API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/materials - добавление материала в справочник
export async function POST(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const body = await request.json()

    const { name, unit, category, sort_order } = body

    // Валидация
    if (!name) {
      return NextResponse.json(
        { error: 'Field "name" is required' },
        { status: 400 }
      )
    }

    if (!unit) {
      return NextResponse.json(
        { error: 'Field "unit" is required' },
        { status: 400 }
      )
    }

    // Определяем sort_order если не передан
    let finalSortOrder = sort_order
    if (finalSortOrder === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (supabase.from as any)('zakaz_materials')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()
      const maxOrder = result.data as { sort_order: number } | null

      finalSortOrder = (maxOrder?.sort_order || 0) + 1
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('zakaz_materials')
      .insert({
        name,
        unit,
        category: category || null,
        sort_order: finalSortOrder,
        is_active: true,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[Materials API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create material', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { material: data, message: 'Material created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Materials API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/materials - обновление материала
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const body = await request.json()

    const { id, name, unit, category, sort_order, is_active, activity_level } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Field "id" is required' },
        { status: 400 }
      )
    }

    // Проверяем существование
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase.from as any)('zakaz_materials')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      )
    }

    // Собираем данные для обновления
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (unit !== undefined) updateData.unit = unit
    if (category !== undefined) updateData.category = category
    if (sort_order !== undefined) updateData.sort_order = sort_order
    if (is_active !== undefined) updateData.is_active = is_active
    if (activity_level !== undefined) updateData.activity_level = activity_level

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('zakaz_materials')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('[Materials API] Database error:', error)
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
    console.error('[Materials API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/materials?id=xxx - удаление материала
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Query parameter "id" is required' },
        { status: 400 }
      )
    }

    // Проверяем существование
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase.from as any)('zakaz_materials')
      .select('id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      )
    }

    // Удаляем
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)('zakaz_materials')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Materials API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete material', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Material deleted successfully',
    })
  } catch (error) {
    console.error('[Materials API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
