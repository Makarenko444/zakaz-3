import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/warehouses/[id]/stock - получить остатки склада
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: warehouseId } = await params
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')

    // Получаем остатки с информацией о материале
    const query = (supabase.from as any)('zakaz_warehouse_stocks')
      .select(`
        *,
        material:zakaz_materials(id, code, name, unit, category, activity_level, price)
      `)
      .eq('warehouse_id', warehouseId)
      .gt('quantity', 0)

    const { data, error } = await query

    if (error) {
      console.error('[Warehouse Stock API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch stocks', details: error.message },
        { status: 500 }
      )
    }

    // Фильтруем по поиску на клиенте (если нужен более сложный поиск)
    let stocks = data || []
    if (search) {
      const lowerSearch = search.toLowerCase()
      stocks = stocks.filter((s: any) =>
        s.material?.name?.toLowerCase().includes(lowerSearch) ||
        s.material?.code?.toLowerCase().includes(lowerSearch)
      )
    }

    // Сортируем по activity_level материала
    stocks.sort((a: any, b: any) => {
      const levelA = a.material?.activity_level || 4
      const levelB = b.material?.activity_level || 4
      if (levelA !== levelB) return levelA - levelB
      return (a.material?.name || '').localeCompare(b.material?.name || '')
    })

    return NextResponse.json({ stocks })
  } catch (error) {
    console.error('[Warehouse Stock API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouses/[id]/stock - обновить остаток материала на складе
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: warehouseId } = await params
    const supabase = createDirectClient()
    const body = await request.json()

    const { stock_id, material_id, quantity } = body

    if (!stock_id && !material_id) {
      return NextResponse.json(
        { error: 'Either stock_id or material_id is required' },
        { status: 400 }
      )
    }

    if (quantity === undefined || quantity === null) {
      return NextResponse.json(
        { error: 'Field "quantity" is required' },
        { status: 400 }
      )
    }

    if (stock_id) {
      // Обновляем по ID записи
      const { data, error } = await (supabase.from as any)('zakaz_warehouse_stocks')
        .update({ quantity })
        .eq('id', stock_id)
        .eq('warehouse_id', warehouseId)
        .select('*')
        .single()

      if (error) {
        console.error('[Warehouse Stock API] Update error:', error)
        return NextResponse.json(
          { error: 'Failed to update stock', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ stock: data, message: 'Stock updated successfully' })
    } else {
      // Upsert по material_id
      const { data, error } = await (supabase.from as any)('zakaz_warehouse_stocks')
        .upsert(
          { warehouse_id: warehouseId, material_id, quantity },
          { onConflict: 'warehouse_id,material_id' }
        )
        .select('*')
        .single()

      if (error) {
        console.error('[Warehouse Stock API] Upsert error:', error)
        return NextResponse.json(
          { error: 'Failed to update stock', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ stock: data, message: 'Stock updated successfully' })
    }
  } catch (error) {
    console.error('[Warehouse Stock API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
