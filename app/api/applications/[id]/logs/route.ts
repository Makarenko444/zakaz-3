import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id } = await params

    // Получаем логи для конкретной заявки
    const { data, error } = await supabase
      .from('zakaz_audit_log')
      .select('*')
      .eq('entity_type', 'application')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching audit logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({ logs: data || [] })
  } catch (error) {
    console.error('Error in audit logs API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
