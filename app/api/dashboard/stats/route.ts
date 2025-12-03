import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

export async function GET(_request: NextRequest) {
  try {
    console.log('[Dashboard Stats API] Получен запрос на статистику')
    const supabase = createDirectClient()

    // Параллельные запросы для оптимизации
    console.log('[Dashboard Stats API] Выполняю запросы к БД...')
    const [
      totalResult,
      newResult,
      inProgressResult,
      installedResult,
      rejectedResult,
      urgencyResult,
      serviceTypeResult,
      customerTypeResult,
      recentApplicationsResult,
      managersResult,
      statusesResult,
    ] = await Promise.all([
      // Общее количество заявок
      supabase
        .from('zakaz_applications')
        .select('*', { count: 'exact', head: true }),

      // Новые заявки (status = 'new')
      supabase
        .from('zakaz_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new'),

      // В работе (несколько статусов)
      supabase
        .from('zakaz_applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['thinking', 'estimation', 'contract', 'design', 'approval', 'queue_install', 'install']),

      // Завершено (status = 'installed')
      supabase
        .from('zakaz_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'installed'),

      // Отклонено/Нет возможности
      supabase
        .from('zakaz_applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['rejected', 'no_tech']),

      // Статистика по срочности (только активные заявки)
      supabase
        .from('zakaz_applications')
        .select('urgency')
        .not('status', 'in', '(rejected,no_tech,installed)'),

      // Статистика по типам услуг (только активные заявки)
      supabase
        .from('zakaz_applications')
        .select('service_type')
        .not('status', 'in', '(rejected,no_tech,installed)'),

      // Статистика по типам клиентов (только активные заявки)
      supabase
        .from('zakaz_applications')
        .select('customer_type')
        .not('status', 'in', '(rejected,no_tech,installed)'),

      // Последние 10 заявок
      supabase
        .from('zakaz_applications')
        .select('id, application_number, customer_fullname, customer_phone, service_type, urgency, status, created_at, street_and_house')
        .order('created_at', { ascending: false })
        .limit(10),

      // Статистика по менеджерам - получаем assigned_to
      supabase
        .from('zakaz_applications')
        .select('assigned_to'),

      // Статистика по всем статусам
      supabase
        .from('zakaz_applications')
        .select('status'),
    ])

    // Проверка на ошибки
    if (totalResult.error) {
      console.error('[Dashboard Stats API] Ошибка totalResult:', totalResult.error)
      throw totalResult.error
    }
    if (newResult.error) {
      console.error('[Dashboard Stats API] Ошибка newResult:', newResult.error)
      throw newResult.error
    }
    if (inProgressResult.error) {
      console.error('[Dashboard Stats API] Ошибка inProgressResult:', inProgressResult.error)
      throw inProgressResult.error
    }
    if (installedResult.error) {
      console.error('[Dashboard Stats API] Ошибка installedResult:', installedResult.error)
      throw installedResult.error
    }
    if (rejectedResult.error) {
      console.error('[Dashboard Stats API] Ошибка rejectedResult:', rejectedResult.error)
      throw rejectedResult.error
    }
    if (urgencyResult.error) {
      console.error('[Dashboard Stats API] Ошибка urgencyResult:', urgencyResult.error)
      throw urgencyResult.error
    }
    if (serviceTypeResult.error) {
      console.error('[Dashboard Stats API] Ошибка serviceTypeResult:', serviceTypeResult.error)
      throw serviceTypeResult.error
    }
    if (customerTypeResult.error) {
      console.error('[Dashboard Stats API] Ошибка customerTypeResult:', customerTypeResult.error)
      throw customerTypeResult.error
    }
    if (recentApplicationsResult.error) {
      console.error('[Dashboard Stats API] Ошибка recentApplicationsResult:', recentApplicationsResult.error)
      throw recentApplicationsResult.error
    }
    if (managersResult.error) {
      console.error('[Dashboard Stats API] Ошибка managersResult:', managersResult.error)
      throw managersResult.error
    }
    if (statusesResult.error) {
      console.error('[Dashboard Stats API] Ошибка statusesResult:', statusesResult.error)
      throw statusesResult.error
    }

    // Подсчитываем статистику по срочности
    const urgencyStats = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    }

    urgencyResult.data?.forEach((item: { urgency: string }) => {
      if (item.urgency in urgencyStats) {
        urgencyStats[item.urgency as keyof typeof urgencyStats]++
      }
    })

    // Подсчитываем статистику по типам услуг
    const serviceTypeStats = {
      apartment: 0,
      office: 0,
      scs: 0,
    }

    serviceTypeResult.data?.forEach((item: { service_type: string }) => {
      if (item.service_type in serviceTypeStats) {
        serviceTypeStats[item.service_type as keyof typeof serviceTypeStats]++
      }
    })

    // Подсчитываем статистику по типам клиентов
    const customerTypeStats = {
      individual: 0,
      business: 0,
    }

    customerTypeResult.data?.forEach((item: { customer_type: string }) => {
      if (item.customer_type in customerTypeStats) {
        customerTypeStats[item.customer_type as keyof typeof customerTypeStats]++
      }
    })

    // Подсчитываем статистику по менеджерам
    const managerStatsMap = new Map<string, number>()
    let unassignedCount = 0

    managersResult.data?.forEach((item: { assigned_to: string | null }) => {
      if (!item.assigned_to) {
        unassignedCount++
      } else {
        const count = managerStatsMap.get(item.assigned_to) || 0
        managerStatsMap.set(item.assigned_to, count + 1)
      }
    })

    // Получаем всех активных пользователей
    interface UserInfo {
      id: string
      full_name: string
      role: string
    }

    const allUsersResult = await supabase
      .from('zakaz_users')
      .select('id, full_name, role')
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (allUsersResult.error) {
      console.error('[Dashboard Stats API] Ошибка allUsersResult:', allUsersResult.error)
      throw allUsersResult.error
    }

    // Создаем статистику по всем пользователям
    const userStats = (allUsersResult.data as UserInfo[] | null || []).map(user => ({
      id: user.id,
      name: user.full_name,
      role: user.role,
      count: managerStatsMap.get(user.id) || 0,
    }))

    // Получаем информацию о менеджерах (только те, у кого есть заявки)
    const managerIds = Array.from(managerStatsMap.keys())

    interface ManagerInfo {
      id: string
      full_name: string
    }

    const managersInfoResult = managerIds.length > 0
      ? await supabase
          .from('zakaz_users')
          .select('id, full_name')
          .in('id', managerIds)
      : { data: [] as ManagerInfo[], error: null }

    if (managersInfoResult.error) {
      console.error('[Dashboard Stats API] Ошибка managersInfoResult:', managersInfoResult.error)
      throw managersInfoResult.error
    }

    const managerStats = managerIds.map(id => {
      const managerInfo = (managersInfoResult.data as ManagerInfo[] | null)?.find(u => u.id === id)
      return {
        id,
        name: managerInfo?.full_name || 'Неизвестный менеджер',
        count: managerStatsMap.get(id) || 0,
      }
    })

    // Добавляем неназначенные заявки
    if (unassignedCount > 0) {
      managerStats.push({
        id: 'unassigned',
        name: 'Менеджер не назначен',
        count: unassignedCount,
      })
    }

    // Сортируем по количеству заявок
    managerStats.sort((a, b) => b.count - a.count)

    // Подсчитываем статистику по статусам
    const statusStatsMap = new Map<string, number>()

    statusesResult.data?.forEach((item: { status: string }) => {
      const count = statusStatsMap.get(item.status) || 0
      statusStatsMap.set(item.status, count + 1)
    })

    const statusLabels: Record<string, string> = {
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

    const statusStats = Array.from(statusStatsMap.entries())
      .map(([status, count]) => ({
        status,
        label: statusLabels[status] || status,
        count,
      }))
      .sort((a, b) => b.count - a.count)

    // Формируем ответ
    const stats = {
      total: totalResult.count || 0,
      new: newResult.count || 0,
      inProgress: inProgressResult.count || 0,
      installed: installedResult.count || 0,
      rejected: rejectedResult.count || 0,
      urgency: urgencyStats,
      serviceType: serviceTypeStats,
      customerType: customerTypeStats,
      managers: managerStats,
      users: userStats,
      statuses: statusStats,
      recentApplications: recentApplicationsResult.data || [],
    }

    console.log('[Dashboard Stats API] Статистика успешно собрана:', stats)
    return NextResponse.json(stats)
  } catch (error) {
    console.error('[Dashboard Stats API] КРИТИЧЕСКАЯ ОШИБКА:', error)
    console.error('[Dashboard Stats API] Тип ошибки:', typeof error)
    console.error('[Dashboard Stats API] Детали:', JSON.stringify(error, null, 2))

    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard statistics',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
