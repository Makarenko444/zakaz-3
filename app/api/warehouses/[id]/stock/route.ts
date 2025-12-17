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
        material:zakaz_materials(id, code, name, unit, category, activity_level)
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
