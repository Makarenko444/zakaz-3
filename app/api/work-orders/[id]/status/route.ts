import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent, getUserData } from '@/lib/audit-log'
import { WorkOrderStatus } from '@/lib/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: 'Черновик',
  assigned: 'Выдан',
  in_progress: 'В работе',
  completed: 'Выполнен',
  cancelled: 'Отменён',
}

// PATCH /api/work-orders/[id]/status - смена статуса наряда
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const body = await request.json()

    const { status, comment, user_id } = body

    // Валидация статуса
    const validStatuses: WorkOrderStatus[] = ['draft', 'assigned', 'in_progress', 'completed', 'cancelled']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      )
    }

    // Получаем текущий наряд
    const { data: currentData, error: fetchError } = await supabase
      .from('zakaz_work_orders')
      .select('*, application:zakaz_applications(application_number)')
      .eq('id', id)
      .single()

    if (fetchError || !currentData) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    const oldStatus = currentData.status as WorkOrderStatus

    // Проверяем что статус действительно меняется
    if (oldStatus === status) {
      return NextResponse.json(
        { error: 'Status is already ' + status },
        { status: 400 }
      )
    }

    // Дополнительные поля при смене статуса
    const updateData: Record<string, unknown> = {
      status,
      updated_by: user_id || null,
    }

    // Автоматически заполняем actual_start_at при переходе в in_progress
    if (status === 'in_progress' && !currentData.actual_start_at) {
      updateData.actual_start_at = new Date().toISOString()
    }

    // Автоматически заполняем actual_end_at при переходе в completed
    if (status === 'completed' && !currentData.actual_end_at) {
      updateData.actual_end_at = new Date().toISOString()
    }

    // Обновляем статус
    const { data, error } = await supabase
      .from('zakaz_work_orders')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update status', details: error.message },
        { status: 500 }
      )
    }

    // Записываем в историю статусов
    await supabase
      .from('zakaz_work_order_status_history')
      .insert({
        work_order_id: id,
        old_status: oldStatus,
        new_status: status,
        changed_by: user_id || null,
        comment: comment || null,
      })

    // Логируем смену статуса
    const userData = await getUserData(user_id)
    const typeLabel = currentData.type === 'survey' ? 'Осмотр и расчёт' : 'Монтаж'

    await logAudit({
      ...userData,
      actionType: 'status_change',
      entityType: 'work_order',
      entityId: id,
      description: `Наряд №${data.work_order_number} (${typeLabel}): ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[status]}`,
      oldValues: { status: oldStatus },
      newValues: { status },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      work_order: data,
      message: `Status changed to ${status}`,
    })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
