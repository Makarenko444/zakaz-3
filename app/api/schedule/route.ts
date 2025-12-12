import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { WorkOrderType } from '@/lib/types'

// Таблицы zakaz_work_orders и zakaz_work_order_executors еще не в сгенерированных типах Supabase

// GET /api/schedule - календарь нарядов
export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    // Параметры
    const view = searchParams.get('view') || 'week' // day | week
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const type = searchParams.get('type') as WorkOrderType | null // survey | installation | null (все)
    const executorId = searchParams.get('executor_id')

    // Вычисляем диапазон дат
    const baseDate = new Date(date)
    let dateFrom: string
    let dateTo: string

    if (view === 'day') {
      dateFrom = date
      dateTo = date
    } else {
      // Неделя: понедельник - воскресенье
      const dayOfWeek = baseDate.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(baseDate)
      monday.setDate(baseDate.getDate() + mondayOffset)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)

      dateFrom = monday.toISOString().split('T')[0]
      dateTo = sunday.toISOString().split('T')[0]
    }

    // Базовый запрос
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from as any)('zakaz_work_orders')
      .select(`
        id,
        work_order_number,
        type,
        status,
        scheduled_date,
        scheduled_time,
        estimated_duration,
        notes,
        application:zakaz_applications(
          id,
          application_number,
          customer_fullname,
          city,
          street_and_house,
          address_details
        ),
        executors:zakaz_work_order_executors(
          id,
          user_id,
          is_lead,
          user:zakaz_users(id, full_name, role)
        )
      `)
      .gte('scheduled_date', dateFrom)
      .lte('scheduled_date', dateTo)
      .not('status', 'eq', 'cancelled') // Исключаем отменённые
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })

    // Фильтр по типу наряда
    if (type) {
      query = query.eq('type', type)
    }

    // Фильтр по исполнителю
    if (executorId) {
      // Получаем ID нарядов этого исполнителя
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: executorWorkOrders } = await (supabase.from as any)('zakaz_work_order_executors')
        .select('work_order_id')
        .eq('user_id', executorId)

      const typedExecutorWorkOrders = executorWorkOrders as { work_order_id: string }[] | null

      if (typedExecutorWorkOrders && typedExecutorWorkOrders.length > 0) {
        const workOrderIds = typedExecutorWorkOrders.map(e => e.work_order_id)
        query = query.in('id', workOrderIds)
      } else {
        return NextResponse.json({
          schedule: [],
          dateRange: { from: dateFrom, to: dateTo },
          view,
        })
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('[Schedule API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch schedule', details: error.message },
        { status: 500 }
      )
    }

    // Группируем по датам для удобства отображения
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupedByDate: Record<string, any[]> = {}

    for (const workOrder of data || []) {
      const dateKey = workOrder.scheduled_date || 'unscheduled'
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = []
      }
      groupedByDate[dateKey].push(workOrder)
    }

    // Получаем статистику по исполнителям на эти даты
    const executorStats = await getExecutorStats(supabase, dateFrom, dateTo)

    return NextResponse.json({
      schedule: data || [],
      groupedByDate,
      dateRange: { from: dateFrom, to: dateTo },
      view,
      executorStats,
    })
  } catch (error) {
    console.error('[Schedule API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Получение статистики загрузки исполнителей
async function getExecutorStats(
  supabase: ReturnType<typeof createDirectClient>,
  dateFrom: string,
  dateTo: string
) {
  try {
    // Получаем всех исполнителей с их нарядами в указанном периоде
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: executors } = await (supabase.from as any)('zakaz_work_order_executors')
      .select(`
        user_id,
        user:zakaz_users(id, full_name, role),
        work_order:zakaz_work_orders(
          id,
          scheduled_date,
          status,
          estimated_duration
        )
      `)

    if (!executors) return []

    // Группируем и считаем статистику
    const statsMap = new Map<string, {
      user_id: string
      full_name: string
      role: string
      total_orders: number
      orders_by_date: Record<string, number>
    }>()

    for (const exec of executors) {
      const workOrder = exec.work_order as {
        scheduled_date: string | null
        status: string
      } | null
      const user = exec.user as { id: string; full_name: string; role: string } | null

      if (!user || !workOrder) continue

      // Проверяем что наряд в нужном диапазоне дат
      if (!workOrder.scheduled_date) continue
      if (workOrder.scheduled_date < dateFrom || workOrder.scheduled_date > dateTo) continue
      if (workOrder.status === 'cancelled') continue

      if (!statsMap.has(exec.user_id)) {
        statsMap.set(exec.user_id, {
          user_id: exec.user_id,
          full_name: user.full_name,
          role: user.role,
          total_orders: 0,
          orders_by_date: {},
        })
      }

      const stat = statsMap.get(exec.user_id)!
      stat.total_orders++

      const dateKey = workOrder.scheduled_date
      stat.orders_by_date[dateKey] = (stat.orders_by_date[dateKey] || 0) + 1
    }

    return Array.from(statsMap.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name, 'ru')
    )
  } catch (error) {
    console.error('[Schedule API] Error getting executor stats:', error)
    return []
  }
}
