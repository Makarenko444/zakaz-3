import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'

// GET - получить все статусы
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createDirectClient()
    const { data, error } = await supabase
      .from('zakaz_application_statuses')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching statuses:', error)
      return NextResponse.json({ error: 'Failed to fetch statuses' }, { status: 500 })
    }

    return NextResponse.json({ statuses: data || [] })
  } catch (error) {
    console.error('Error in admin statuses GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - создать новый статус
export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, name_ru, description_ru, sort_order, is_active } = body

    if (!code || !name_ru) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createDirectClient()

    // Проверяем, не существует ли уже статус с таким кодом
    const { data: existingStatus } = await supabase
      .from('zakaz_application_statuses')
      .select('id')
      .eq('code', code)
      .single()

    if (existingStatus) {
      return NextResponse.json(
        { error: 'Status with this code already exists' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('zakaz_application_statuses')
      .insert({
        code,
        name_ru,
        description_ru: description_ru || null,
        sort_order: sort_order || 0,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating status:', error)
      return NextResponse.json({ error: 'Failed to create status' }, { status: 500 })
    }

    return NextResponse.json({ status: data })
  } catch (error) {
    console.error('Error in admin statuses POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
