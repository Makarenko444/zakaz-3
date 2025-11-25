import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface StatsRow {
  node_id: string
  address: string
  city: string | null
  street: string | null
  house: string | null
  building: string | null
  status: string
  status_name: string
  count: number
}

export async function GET() {
  try {
    const supabase = createDirectClient()

    // Получаем все адреса с количеством заявок
    const { data: stats, error } = await supabase.rpc('get_applications_by_address_stats') as { data: StatsRow[] | null; error: unknown }

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to load statistics', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      )
    }

    // Группируем данные по адресам
    const groupedStats = new Map<string, {
      node_id: string
      address: string
      city: string | null
      street: string | null
      house: string | null
      building: string | null
      total_applications: number
      active_count: number
      completed_count: number
      by_status: Array<{ status: string; status_name: string; count: number }>
    }>()

    for (const row of stats || []) {
      const key = row.node_id
      if (!groupedStats.has(key)) {
        groupedStats.set(key, {
          node_id: row.node_id,
          address: row.address || `${row.street}, ${row.house}`,
          city: row.city,
          street: row.street,
          house: row.house,
          building: row.building,
          total_applications: 0,
          active_count: 0,
          completed_count: 0,
          by_status: []
        })
      }

      const addr = groupedStats.get(key)!
      const count = parseInt(row.count) || 0

      addr.total_applications += count

      // Считаем активные (не завершенные статусы)
      if (!['installed', 'rejected', 'no_tech'].includes(row.status)) {
        addr.active_count += count
      } else {
        addr.completed_count += count
      }

      addr.by_status.push({
        status: row.status,
        status_name: row.status_name,
        count
      })
    }

    // Преобразуем Map в массив и сортируем по количеству заявок
    const result = Array.from(groupedStats.values()).sort((a, b) =>
      b.total_applications - a.total_applications
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
