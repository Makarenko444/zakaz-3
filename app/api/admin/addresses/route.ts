import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'

// GET - получить все адреса
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createDirectClient()
    const { data, error } = await supabase
      .from('zakaz_addresses')
      .select('*')
      .order('street', { ascending: true })
      .order('house', { ascending: true })

    if (error) {
      console.error('Error fetching addresses:', error)
      return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 })
    }

    return NextResponse.json({ addresses: data || [] })
  } catch (error) {
    console.error('Error in admin addresses GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - создать новый адрес
export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { street, house, entrance, comment } = body

    if (!street || !house) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createDirectClient()

    const table = supabase.from('zakaz_addresses') as unknown
    const insertBuilder = (table as { insert: (data: Record<string, unknown>) => unknown }).insert({
      street,
      house,
      entrance: entrance || null,
      comment: comment || null,
    }) as unknown
    const selectBuilder = (insertBuilder as { select: () => unknown }).select() as unknown
    const result = await (selectBuilder as { single: () => Promise<unknown> }).single()
    const { data, error } = result as { data: unknown; error: unknown }

    if (error) {
      console.error('Error creating address:', error)
      return NextResponse.json({ error: 'Failed to create address' }, { status: 500 })
    }

    return NextResponse.json({ address: data })
  } catch (error) {
    console.error('Error in admin addresses POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
