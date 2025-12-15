import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface ApplicationRow {
  id: string
  application_number: number
  customer_fullname: string
  customer_phone: string
  service_type: string
  urgency: string
  status: string
  created_at: string
  street_and_house: string | null
  assigned_to: string | null
}

interface UserRow {
  id: string
  full_name: string
  role?: string
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = createDirectClient()

    // Получаем все заявки для подсчёта статистики
    const { data: applications, error: appsError } = await supabase
      .from('zakaz_applications')
      .select('id, application_number, customer_fullname, customer_phone, service_type, urgency, status, created_at, street_and_house, assigned_to')
      .order('created_at', { ascending: false })

    if (appsError) {
      console.error('[Dashboard Stats API] Ошибка загрузки заявок:', appsError)
      return NextResponse.json(
        { error: 'Failed to fetch applications', details: appsError.message },
        { status: 500 }
      )
    }

    const allApps = (applications || []) as ApplicationRow[]

    // Подсчитываем статистику
    const total = allApps.length
    const newCount = allApps.filter(a => a.status === 'new').length
    const inProgressStatuses = ['thinking', 'estimation', 'contract', 'design', 'approval', 'queue_install', 'install']
    const inProgress = allApps.filter(a => inProgressStatuses.includes(a.status)).length
    const installed = allApps.filter(a => a.status === 'installed').length
    const rejected = allApps.filter(a => a.status === 'rejected' || a.status === 'no_tech').length

    // Статистика по статусам
    const statusStatsMap = new Map<string, number>()
    allApps.forEach(app => {
      const count = statusStatsMap.get(app.status) || 0
      statusStatsMap.set(app.status, count + 1)
    })

    const statusLabels: Record<string, string> = {
      new: 'Новая',
      thinking: 'Думает',
      estimation: 'Расчёт',
      estimation_done: 'Расчёт выполнен',
      contract: 'Договор и оплата',
      design: 'Проектирование',
      approval: 'Согласование',
      queue_install: 'Очередь на монтаж',
      install: 'Монтаж',
      installed: 'Выполнено',
      rejected: 'Отказ',
      no_tech: 'Нет возможности',
    }

    // Порядок статусов по этапам работы
    const statusOrder = ['new', 'thinking', 'estimation', 'estimation_done', 'contract', 'design', 'approval', 'queue_install', 'install', 'installed', 'rejected', 'no_tech']

    const statuses = Array.from(statusStatsMap.entries())
      .map(([status, count]) => ({
        status,
        label: statusLabels[status] || status,
        count,
      }))
      .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))

    // Статистика по менеджерам
    const managerStatsMap = new Map<string, number>()
    let unassignedCount = 0

    allApps.forEach(app => {
      if (!app.assigned_to) {
        unassignedCount++
      } else {
        const count = managerStatsMap.get(app.assigned_to) || 0
        managerStatsMap.set(app.assigned_to, count + 1)
      }
    })

    // Получаем информацию о менеджерах
    const managerIds = Array.from(managerStatsMap.keys())

    let managers: Array<{ id: string; name: string; count: number }> = []

    if (managerIds.length > 0) {
      const { data: managersData, error: managersError } = await supabase
        .from('zakaz_users')
        .select('id, full_name')
        .in('id', managerIds)

      if (!managersError && managersData) {
        const typedManagersData = managersData as UserRow[]
        managers = managerIds.map(id => {
          const managerInfo = typedManagersData.find(u => u.id === id)
          return {
            id,
            name: managerInfo?.full_name || 'Неизвестный менеджер',
            count: managerStatsMap.get(id) || 0,
          }
        })
      }
    }

    if (unassignedCount > 0) {
      managers.push({
        id: 'unassigned',
        name: 'Менеджер не назначен',
        count: unassignedCount,
      })
    }

    managers.sort((a, b) => b.count - a.count)

    // Получаем всех активных пользователей
    const { data: usersData, error: usersError } = await supabase
      .from('zakaz_users')
      .select('id, full_name, role')
      .eq('active', true)
      .order('full_name', { ascending: true })

    let users: Array<{ id: string; name: string; role: string; count: number }> = []

    if (!usersError && usersData) {
      const typedUsersData = usersData as UserRow[]
      users = typedUsersData.map(user => ({
        id: user.id,
        name: user.full_name,
        role: user.role || 'user',
        count: managerStatsMap.get(user.id) || 0,
      }))
    }

    // Последние 10 заявок
    const recentApplications = allApps.slice(0, 10)

    // Формируем ответ
    const stats = {
      total,
      new: newCount,
      inProgress,
      installed,
      rejected,
      statuses,
      managers,
      users,
      recentApplications,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[Dashboard Stats API] КРИТИЧЕСКАЯ ОШИБКА:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard statistics',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
