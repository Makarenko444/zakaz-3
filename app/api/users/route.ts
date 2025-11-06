import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

export async function GET() {
  try {
    const supabase = createDirectClient()

    // Получаем только активных пользователей
    const { data, error } = await supabase
      .from('zakaz_users')
      .select('id, full_name, email, role')
      .eq('active', true)
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    return NextResponse.json({ users: data || [] })
  } catch (error) {
    console.error('Error in users API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
