import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { WorkOrderStatus } from '@/lib/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface StatusHistoryRecord {
  id: string
  work_order_id: string
  old_status: WorkOrderStatus | null
  new_status: WorkOrderStatus
  changed_by: string | null
  comment: string | null
  changed_at: string
  user?: {
    id: string
    full_name: string
  } | null
}

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: 'Черновик',
  assigned: 'Выдан',
  in_progress: 'В работе',
  completed: 'Выполнен',
  cancelled: 'Отменён',
}

// GET /api/work-orders/[id]/history - получение истории статусов наряда
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()

    // Получаем историю статусов
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: history, error: historyError } = await (supabase.from as any)('zakaz_work_order_status_history')
      .select(`
        id,
        work_order_id,
        old_status,
        new_status,
        changed_by,
        comment,
        changed_at,
        user:zakaz_users!changed_by(id, full_name)
      `)
      .eq('work_order_id', id)
      .order('changed_at', { ascending: true })

    if (historyError) {
      console.error('[WorkOrders History API] Database error:', historyError)
      return NextResponse.json(
        { error: 'Failed to fetch history', details: historyError.message },
        { status: 500 }
      )
    }

    // Получаем информацию о создании наряда
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workOrder, error: woError } = await (supabase.from as any)('zakaz_work_orders')
      .select('id, work_order_number, created_at, created_by')
      .eq('id', id)
      .single()

    if (woError) {
      console.error('[WorkOrders History API] Work order fetch error:', woError)
    }

    // Получаем информацию о создателе отдельным запросом
    let createdByUser = null
    if (workOrder?.created_by) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userData } = await (supabase.from as any)('zakaz_users')
        .select('id, full_name')
        .eq('id', workOrder.created_by)
        .single()
      createdByUser = userData
    }

    // Формируем результат
    const historyWithLabels = (history || []).map((record: StatusHistoryRecord) => ({
      ...record,
      old_status_label: record.old_status ? STATUS_LABELS[record.old_status] : null,
      new_status_label: STATUS_LABELS[record.new_status],
    }))

    return NextResponse.json({
      history: historyWithLabels,
      created: workOrder ? {
        created_at: workOrder.created_at,
        created_by: workOrder.created_by,
        created_by_user: createdByUser,
      } : null,
    })
  } catch (error) {
    console.error('[WorkOrders History API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
