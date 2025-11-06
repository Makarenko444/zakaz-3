import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

export async function GET() {
  try {
    const supabase = createDirectClient()

    // Получаем все активные статусы, отсортированные по порядку
    const { data, error } = await supabase
      .from('zakaz_application_statuses')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching statuses:', error)
      return NextResponse.json(
        { error: 'Failed to fetch statuses' },
        { status: 500 }
      )
    }

    return NextResponse.json({ statuses: data || [] })
  } catch (error) {
    console.error('Error in statuses API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
