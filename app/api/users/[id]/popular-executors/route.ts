import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/users/[id]/popular-executors - получить популярных исполнителей для автора
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params
    const supabase = createDirectClient()

    // Шаг 1: Получаем все наряды, созданные этим пользователем
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workOrders, error: woError } = await (supabase.from as any)('zakaz_work_orders')
      .select('id')
      .eq('created_by', userId)

    if (woError || !workOrders || workOrders.length === 0) {
      return NextResponse.json({ popular_executor_ids: [] })
    }

    const workOrderIds = workOrders.map((wo: { id: string }) => wo.id)

    // Шаг 2: Получаем всех исполнителей этих нарядов
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: executors, error: execError } = await (supabase.from as any)('zakaz_work_order_executors')
      .select('user_id')
      .in('work_order_id', workOrderIds)

    if (execError || !executors) {
      return NextResponse.json({ popular_executor_ids: [] })
    }

    // Шаг 3: Подсчитываем количество использований каждого исполнителя
    const countMap: Record<string, number> = {}
    for (const row of executors) {
      const execId = row.user_id
      // Не считаем самого автора
      if (execId !== userId) {
        countMap[execId] = (countMap[execId] || 0) + 1
      }
    }

    // Шаг 4: Сортируем по частоте и берём топ-10
    const sorted = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([execId]) => execId)

    return NextResponse.json({ popular_executor_ids: sorted })
  } catch (error) {
    console.error('Error fetching popular executors:', error)
    return NextResponse.json({ popular_executor_ids: [] })
  }
}
