import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent, getUserData } from '@/lib/audit-log'

// Функция для получения названия статуса из БД
async function getStatusLabel(supabase: ReturnType<typeof createDirectClient>, statusCode: string): Promise<string> {
  const { data, error } = await supabase
    .from('zakaz_application_statuses')
    .select('name_ru')
    .eq('code', statusCode)
    .single() as { data: { name_ru: string } | null; error: unknown }

  if (error || !data) {
    // Fallback на код статуса если не найден в БД
    return statusCode
  }

  return data.name_ru
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

    // Проверяем, что статус существует в БД
    const { data: statusCheck, error: statusError } = await supabase
      .from('zakaz_application_statuses')
      .select('code')
      .eq('code', body.new_status)
      .eq('is_active', true)
      .single()

    if (statusError || !statusCheck) {
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
    const updateData: {
      status: string
      updated_by: string | null
      updated_at: string
    } = {
      status: body.new_status,
      updated_by: body.changed_by || null,
      updated_at: new Date().toISOString(),
    }

    console.log('Updating application:', id, 'with data:', updateData)

    const updateResult = await supabase
      .from('zakaz_applications')
      .update(updateData as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .eq('id', id)

    const { error: updateError } = updateResult

    if (updateError) {
      console.error('Error updating application status:', updateError)
      console.error('Error details:', JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        { error: `Failed to update status: ${updateError.message || JSON.stringify(updateError)}` },
        { status: 500 }
      )
    }

    // Записываем в историю изменений статуса
    const historyData: {
      application_id: string
      old_status: string
      new_status: string
      comment: string | null
      changed_by: string | null
    } = {
      application_id: id,
      old_status: oldStatus,
      new_status: body.new_status,
      comment: body.comment || null,
      changed_by: body.changed_by || null,
    }

    console.log('Inserting status history:', historyData)

    const historyResult = await supabase
      .from('zakaz_application_status_history')
      .insert(historyData as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const { error: historyError } = historyResult

    if (historyError) {
      console.error('Error inserting status history:', historyError)
      console.error('History error details:', JSON.stringify(historyError, null, 2))
      // Не возвращаем ошибку, так как основное действие (обновление статуса) прошло успешно
    }

    // Логируем действие - получаем русские названия из БД
    const oldStatusLabel = await getStatusLabel(supabase, oldStatus)
    const newStatusLabel = await getStatusLabel(supabase, body.new_status)

    // Получаем данные пользователя для аудита
    const userData = await getUserData(body.changed_by)

    await logAudit({
      ...userData,
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
      .select(`
        *,
        zakaz_addresses(street, house, comment),
        assigned_user:zakaz_users!zakaz_applications_assigned_to_fkey(id, full_name, email, role),
        created_by_user:zakaz_users!zakaz_applications_created_by_fkey(id, full_name, email, role),
        updated_by_user:zakaz_users!zakaz_applications_updated_by_fkey(id, full_name, email, role)
      `)
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
