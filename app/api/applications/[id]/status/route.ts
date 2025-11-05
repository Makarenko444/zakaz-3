import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { ApplicationStatus } from '@/lib/types'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'

// Переводы статусов на русский
const statusLabels: Record<ApplicationStatus, string> = {
  new: 'Новая',
  thinking: 'Думает',
  estimation: 'Расчёт',
  waiting_payment: 'Ожидание оплаты',
  contract: 'Договор',
  queue_install: 'Очередь на монтаж',
  install: 'Монтаж',
  installed: 'Выполнено',
  rejected: 'Отказ',
  no_tech: 'Нет тех. возможности',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id } = await params
    const body = await request.json()

    // Валидация
    if (!body.new_status) {
      return NextResponse.json(
        { error: 'new_status is required' },
        { status: 400 }
      )
    }

    const validStatuses: ApplicationStatus[] = [
      'new',
      'thinking',
      'estimation',
      'waiting_payment',
      'contract',
      'queue_install',
      'install',
      'installed',
      'rejected',
      'no_tech',
    ]

    if (!validStatuses.includes(body.new_status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      )
    }

    // Получаем текущий статус заявки
    const { data: currentApp, error: fetchError } = await supabase
      .from('zakaz_applications')
      .select('status')
      .eq('id', id)
      .single() as { data: { status: string } | null; error: unknown }

    if (fetchError || !currentApp) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    const oldStatus = currentApp.status

    // Обновляем статус заявки
    const updateData = {
      status: body.new_status,
      updated_at: new Date().toISOString(),
    }

    const table = supabase.from('zakaz_applications') as unknown
    const builder = (table as { update: (data: Record<string, unknown>) => unknown }).update(updateData) as unknown
    const query = (builder as { eq: (col: string, val: string) => Promise<unknown> }).eq('id', id)
    const updateResult = await query
    const { error: updateError } = updateResult as { error: unknown }

    if (updateError) {
      console.error('Error updating application status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update status' },
        { status: 500 }
      )
    }

    // Записываем в историю изменений статуса
    const historyData = {
      application_id: id,
      old_status: oldStatus,
      new_status: body.new_status,
      comment: body.comment || null,
      changed_by: body.changed_by || null,
    }

    const historyTable = supabase.from('zakaz_application_status_history') as unknown
    const historyBuilder = (historyTable as { insert: (data: Record<string, unknown>) => Promise<unknown> }).insert(historyData)
    const historyResult = await historyBuilder
    const { error: historyError } = historyResult as { error: unknown }

    if (historyError) {
      console.error('Error inserting status history:', historyError)
      // Не возвращаем ошибку, так как основное действие (обновление статуса) прошло успешно
    }

    // Логируем действие
    const oldStatusLabel = statusLabels[oldStatus as ApplicationStatus] || oldStatus
    const newStatusLabel = statusLabels[body.new_status as ApplicationStatus] || body.new_status

    await logAudit({
      userId: body.changed_by || undefined,
      actionType: 'status_change',
      entityType: 'application',
      entityId: id,
      description: `Изменен статус заявки с "${oldStatusLabel}" на "${newStatusLabel}"${body.comment ? `: ${body.comment}` : ''}`,
      oldValues: { status: oldStatus },
      newValues: { status: body.new_status },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    // Получаем обновленную заявку
    const { data: updatedApp, error: selectError } = await supabase
      .from('zakaz_applications')
      .select('*, zakaz_addresses(street, house, entrance, comment)')
      .eq('id', id)
      .single()

    if (selectError) {
      return NextResponse.json(
        { error: 'Failed to fetch updated application' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      application: updatedApp,
      message: 'Status updated successfully',
    })
  } catch (error) {
    console.error('Error in status change:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
