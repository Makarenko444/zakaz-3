import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

export async function GET(request: NextRequest) {
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
        .in('status', ['thinking', 'estimation', 'waiting_payment', 'contract', 'queue_install', 'install']),

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

      // Статистика по срочности
      supabase
        .from('zakaz_applications')
        .select('urgency'),

      // Статистика по типам услуг
      supabase
        .from('zakaz_applications')
        .select('service_type'),

      // Статистика по типам клиентов
      supabase
        .from('zakaz_applications')
        .select('customer_type'),

      // Последние 10 заявок
      supabase
        .from('zakaz_applications')
        .select('id, application_number, customer_fullname, customer_phone, service_type, urgency, status, created_at, zakaz_addresses(street, house, entrance)')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Проверка на ошибки
    if (totalResult.error) throw totalResult.error
    if (newResult.error) throw newResult.error
    if (inProgressResult.error) throw inProgressResult.error
    if (installedResult.error) throw installedResult.error
    if (rejectedResult.error) throw rejectedResult.error
    if (urgencyResult.error) throw urgencyResult.error
    if (serviceTypeResult.error) throw serviceTypeResult.error
    if (customerTypeResult.error) throw customerTypeResult.error
    if (recentApplicationsResult.error) throw recentApplicationsResult.error

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
      recentApplications: recentApplicationsResult.data || [],
    }

    console.log('[Dashboard Stats API] Статистика успешно собрана:', stats)
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}
