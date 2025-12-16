import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'

// POST /api/work-orders/[id]/complete - Отметка об исполнении наряда
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const workOrderId = params.id

    // Проверка аутентификации
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createDirectClient()

    // Получаем наряд
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workOrder, error: woError } = await (supabase.from as any)('zakaz_work_orders')
      .select(`
        id,
        status,
        created_by,
        executors:zakaz_work_order_executors(user_id)
      `)
      .eq('id', workOrderId)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    // Проверка прав: админ, автор или исполнитель
    const executorIds = (workOrder.executors || []).map((e: { user_id: string }) => e.user_id)
    const isExecutor = executorIds.includes(user.id)
    const canComplete = user.role === 'admin' || workOrder.created_by === user.id || isExecutor

    if (!canComplete) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Получаем данные отчёта
    const body = await request.json()
    const { result_notes, actual_end_at } = body

    // Обновляем наряд
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: updateError } = await (supabase.from as any)('zakaz_work_orders')
      .update({
        status: 'completed',
        result_notes: result_notes || null,
        actual_end_at: actual_end_at || new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', workOrderId)
      .select()
      .single()

    if (updateError) {
      console.error('Error completing work order:', updateError)
      return NextResponse.json({ error: 'Failed to complete work order' }, { status: 500 })
    }

    // Добавляем запись в историю статусов
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from as any)('zakaz_work_order_status_history')
      .insert({
        work_order_id: workOrderId,
        old_status: workOrder.status,
        new_status: 'completed',
        changed_by: user.id,
        comment: result_notes || 'Наряд выполнен',
      })

    return NextResponse.json({ work_order: updated }, { status: 200 })
  } catch (error) {
    console.error('Error completing work order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
