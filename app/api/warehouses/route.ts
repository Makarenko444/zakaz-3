import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { Warehouse } from '@/lib/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/warehouses - список складов
export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams
    const activeOnly = searchParams.get('active_only') !== 'false'

    let query = (supabase.from as any)('zakaz_warehouses')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Warehouses API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch warehouses', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      warehouses: data as Warehouse[] || [],
    })
  } catch (error) {
    console.error('[Warehouses API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/warehouses - создание склада
export async function POST(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const body = await request.json()

    const { name, code, address } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Название склада обязательно' },
        { status: 400 }
      )
    }

    // Определяем sort_order
    const { data: maxSort } = await (supabase.from as any)('zakaz_warehouses')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxSort?.sort_order || 0) + 1

    const { data, error } = await (supabase.from as any)('zakaz_warehouses')
      .insert({
        name,
        code: code || null,
        address: address || null,
        sort_order: nextSortOrder,
        is_active: true,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[Warehouses API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create warehouse', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ warehouse: data }, { status: 201 })
  } catch (error) {
    console.error('[Warehouses API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/warehouses - обновление склада
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const body = await request.json()

    const { id, name, code, address, is_active, sort_order } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID склада обязателен' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (code !== undefined) updateData.code = code
    if (address !== undefined) updateData.address = address
    if (is_active !== undefined) updateData.is_active = is_active
    if (sort_order !== undefined) updateData.sort_order = sort_order

    const { data, error } = await (supabase.from as any)('zakaz_warehouses')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('[Warehouses API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update warehouse', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ warehouse: data })
  } catch (error) {
    console.error('[Warehouses API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouses?id=xxx - удаление склада
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID склада обязателен' },
        { status: 400 }
      )
    }

    const { error } = await (supabase.from as any)('zakaz_warehouses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Warehouses API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete warehouse', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Warehouses API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
