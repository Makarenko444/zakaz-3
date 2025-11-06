import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

export async function GET() {
  try {
    const supabase = createDirectClient()

    const { data, error } = await supabase
      .from('zakaz_addresses')
      .select('*')
      .order('street', { ascending: true })
      .order('house', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch addresses', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ addresses: data || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
