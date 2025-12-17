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
  technical_curator_id: string | null
}

interface UserRow {
  id: string
  full_name: string
  role?: string
  active?: boolean
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = createDirectClient()

    // Получаем все заявки для подсчёта статистики
    const { data: applications, error: appsError } = await supabase
      .from('zakaz_applications')
      .select('id, application_number, customer_fullname, customer_phone, service_type, urgency, status, created_at, street_and_house, assigned_to, technical_curator_id')
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

    // Статистика по менеджерам (всего и активных)
    const completedStatuses = ['installed', 'rejected', 'no_tech']
    const managerStatsMap = new Map<string, { total: number; active: number }>()
    let unassignedTotal = 0
    let unassignedActive = 0

    allApps.forEach(app => {
      const isActive = !completedStatuses.includes(app.status)
      if (!app.assigned_to) {
        unassignedTotal++
        if (isActive) unassignedActive++
      } else {
        const stats = managerStatsMap.get(app.assigned_to) || { total: 0, active: 0 }
        stats.total++
        if (isActive) stats.active++
        managerStatsMap.set(app.assigned_to, stats)
      }
    })

    // Получаем информацию о менеджерах
    const managerIds = Array.from(managerStatsMap.keys())

    let managers: Array<{ id: string; name: string; count: number; activeCount: number; isActive: boolean }> = []

    if (managerIds.length > 0) {
      const { data: managersData, error: managersError } = await supabase
        .from('zakaz_users')
        .select('id, full_name, active')
        .in('id', managerIds)

      if (!managersError && managersData) {
        const typedManagersData = managersData as UserRow[]
        managers = managerIds.map(id => {
          const managerInfo = typedManagersData.find(u => u.id === id)
          const stats = managerStatsMap.get(id) || { total: 0, active: 0 }
          return {
            id,
            name: managerInfo?.full_name || 'Неизвестный менеджер',
            count: stats.total,
            activeCount: stats.active,
            isActive: managerInfo?.active ?? true, // Статус сотрудника (активен/уволен)
          }
        })
      }
    }

    if (unassignedTotal > 0) {
      managers.push({
        id: 'unassigned',
        name: 'Менеджер не назначен',
        count: unassignedTotal,
        activeCount: unassignedActive,
        isActive: true, // "Не назначен" всегда показываем как активный
      })
    }

    managers.sort((a, b) => b.count - a.count)

    // Статистика по техническим кураторам (всего и активных)
    const curatorStatsMap = new Map<string, { total: number; active: number }>()
    let unassignedCuratorTotal = 0
    let unassignedCuratorActive = 0

    allApps.forEach(app => {
      const isActive = !completedStatuses.includes(app.status)
      if (!app.technical_curator_id) {
        unassignedCuratorTotal++
        if (isActive) unassignedCuratorActive++
      } else {
        const stats = curatorStatsMap.get(app.technical_curator_id) || { total: 0, active: 0 }
        stats.total++
        if (isActive) stats.active++
        curatorStatsMap.set(app.technical_curator_id, stats)
      }
    })

    // Получаем информацию о кураторах
    const curatorIds = Array.from(curatorStatsMap.keys())

    let curators: Array<{ id: string; name: string; count: number; activeCount: number; isActive: boolean }> = []

    if (curatorIds.length > 0) {
      const { data: curatorsData, error: curatorsError } = await supabase
        .from('zakaz_users')
        .select('id, full_name, active')
        .in('id', curatorIds)

      if (!curatorsError && curatorsData) {
        const typedCuratorsData = curatorsData as UserRow[]
        curators = curatorIds.map(id => {
          const curatorInfo = typedCuratorsData.find(u => u.id === id)
          const stats = curatorStatsMap.get(id) || { total: 0, active: 0 }
          return {
            id,
            name: curatorInfo?.full_name || 'Неизвестный куратор',
            count: stats.total,
            activeCount: stats.active,
            isActive: curatorInfo?.active ?? true,
          }
        })
      }
    }

    if (unassignedCuratorTotal > 0) {
      curators.push({
        id: 'unassigned',
        name: 'Куратор не назначен',
        count: unassignedCuratorTotal,
        activeCount: unassignedCuratorActive,
        isActive: true,
      })
    }

    curators.sort((a, b) => b.count - a.count)

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
        count: managerStatsMap.get(user.id)?.total || 0,
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
      curators,
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
