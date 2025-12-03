import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface ApplicationRow {
  id: string
  status: string
  address_id: string | null
  zakaz_addresses: {
    id: string
    city: string | null
    street: string | null
    house: string | null
    building: string | null
    address: string
  } | null
}

interface StatusRow {
  code: string
  name_ru: string
}

export async function GET() {
  try {
    const supabase = createDirectClient()

    // Получаем все заявки с привязанными адресами
    const { data: applications, error: appsError } = await supabase
      .from('zakaz_applications')
      .select(`
        id,
        status,
        address_id,
        zakaz_addresses (
          id,
          city,
          street,
          house,
          building,
          address
        )
      `)
      .not('address_id', 'is', null) as { data: ApplicationRow[] | null; error: unknown }

    if (appsError) {
      console.error('Error loading applications:', appsError)
      return NextResponse.json(
        { error: 'Failed to load applications' },
        { status: 500 }
      )
    }

    // Получаем названия статусов
    const { data: statuses } = await supabase
      .from('zakaz_statuses')
      .select('code, name_ru') as { data: StatusRow[] | null }

    // Fallback русские названия статусов
    const statusNames: Record<string, string> = {
      new: 'Новая',
      thinking: 'Думает',
      estimation: 'Расчёт',
      contract: 'Договор и оплата',
      design: 'Проектирование',
      approval: 'Согласование',
      queue_install: 'Очередь на монтаж',
      install: 'Монтаж',
      installed: 'Выполнено',
      rejected: 'Отказ',
      no_tech: 'Нет возможности',
    }

    // Дополняем из БД, если есть
    for (const s of statuses || []) {
      statusNames[s.code] = s.name_ru
    }

    // Группируем по адресам
    const groupedStats = new Map<string, {
      address_id: string
      address: string
      city: string | null
      street: string | null
      house: string | null
      building: string | null
      total_applications: number
      active_count: number
      completed_count: number
      by_status: Map<string, { status: string; status_name: string; count: number }>
    }>()

    for (const app of applications || []) {
      if (!app.address_id || !app.zakaz_addresses) continue

      const key = app.address_id
      if (!groupedStats.has(key)) {
        groupedStats.set(key, {
          address_id: app.address_id,
          address: app.zakaz_addresses.address || `${app.zakaz_addresses.street}, ${app.zakaz_addresses.house}`,
          city: app.zakaz_addresses.city,
          street: app.zakaz_addresses.street,
          house: app.zakaz_addresses.house,
          building: app.zakaz_addresses.building,
          total_applications: 0,
          active_count: 0,
          completed_count: 0,
          by_status: new Map()
        })
      }

      const addr = groupedStats.get(key)!
      addr.total_applications += 1

      // Считаем активные/завершённые
      if (!['installed', 'rejected', 'no_tech'].includes(app.status)) {
        addr.active_count += 1
      } else {
        addr.completed_count += 1
      }

      // Группируем по статусам
      if (!addr.by_status.has(app.status)) {
        addr.by_status.set(app.status, {
          status: app.status,
          status_name: statusNames[app.status] || app.status,
          count: 0
        })
      }
      addr.by_status.get(app.status)!.count += 1
    }

    // Преобразуем в массив
    const result = Array.from(groupedStats.values())
      .map(addr => ({
        address_id: addr.address_id,
        address: addr.address,
        city: addr.city,
        street: addr.street,
        house: addr.house,
        building: addr.building,
        total_applications: addr.total_applications,
        active_count: addr.active_count,
        completed_count: addr.completed_count,
        by_status: Array.from(addr.by_status.values())
      }))
      .sort((a, b) => b.total_applications - a.total_applications)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
