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

    // Получаем статистику исполнителей по нарядам, созданным этим пользователем
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_popular_executors_for_user', {
      p_user_id: userId,
      p_limit: 10,
    })

    if (error) {
      // Если функция не существует, делаем запрос напрямую
      console.log('RPC not available, using direct query')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: executorStats, error: queryError } = await (supabase.from as any)('zakaz_work_order_executors')
        .select(`
          user_id,
          work_order:zakaz_work_orders!inner(created_by)
        `)
        .eq('work_order.created_by', userId)

      if (queryError) {
        console.error('Query error:', queryError)
        return NextResponse.json({ popular_executor_ids: [] })
      }

      // Подсчитываем количество использований каждого исполнителя
      const countMap: Record<string, number> = {}
      for (const row of executorStats || []) {
        const execId = row.user_id
        countMap[execId] = (countMap[execId] || 0) + 1
      }

      // Сортируем по частоте и берём топ-10
      const sorted = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([execId]) => execId)

      return NextResponse.json({ popular_executor_ids: sorted })
    }

    return NextResponse.json({
      popular_executor_ids: (data || []).map((r: { executor_id: string }) => r.executor_id)
    })
  } catch (error) {
    console.error('Error fetching popular executors:', error)
    return NextResponse.json({ popular_executor_ids: [] })
  }
}
