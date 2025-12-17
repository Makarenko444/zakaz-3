import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent, getUserData } from '@/lib/audit-log'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id } = await params
    const body = await request.json()

    // technical_curator_id может быть null (снять назначение) или UUID пользователя
    const technicalCuratorId = body.technical_curator_id === '' ? null : body.technical_curator_id

    // Получаем текущее значение technical_curator_id для логирования
    const { data: currentApp } = await supabase
      .from('zakaz_applications')
      .select('technical_curator_id, application_number')
      .eq('id', id)
      .single() as { data: { technical_curator_id: string | null; application_number: string } | null }

    const oldTechnicalCuratorId = currentApp?.technical_curator_id || null

    // Получаем имя старого технического куратора если был
    let oldUserName = null
    if (oldTechnicalCuratorId) {
      const { data: oldUser } = await supabase
        .from('zakaz_users')
        .select('full_name')
        .eq('id', oldTechnicalCuratorId)
        .single() as { data: { full_name: string } | null }
      oldUserName = oldUser?.full_name || null
    }

    // Получаем имя нового технического куратора и проверяем что он существует
    let newUserName = null
    if (technicalCuratorId) {
      const { data: user, error: userError } = await supabase
        .from('zakaz_users')
        .select('id, full_name')
        .eq('id', technicalCuratorId)
        .single() as { data: { id: string; full_name: string } | null; error: unknown }

      if (userError || !user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
      newUserName = user.full_name
    }

    // Обновляем технического куратора
    const updateData = {
      technical_curator_id: technicalCuratorId,
      updated_by: body.changed_by || null,
      updated_at: new Date().toISOString(),
    }

    // Обходим проблемы с автогенерируемыми типами Supabase через unknown
    const table = supabase.from('zakaz_applications') as unknown
    const builder = (table as { update: (data: Record<string, unknown>) => unknown }).update(updateData) as unknown
    const query = (builder as { eq: (col: string, val: string) => Promise<unknown> }).eq('id', id)
    const result = await query
    const { error: updateError } = result as { error: unknown }

    if (updateError) {
      console.error('Error assigning technical curator to application:', updateError)
      return NextResponse.json(
        { error: 'Failed to assign technical curator' },
        { status: 500 }
      )
    }

    // Логируем действие с именами пользователей
    let actionDescription = ''
    if (technicalCuratorId) {
      if (oldTechnicalCuratorId) {
        actionDescription = `Технический куратор изменен с "${oldUserName || 'Неизвестно'}" на "${newUserName}"`
      } else {
        actionDescription = `Назначен технический куратор: ${newUserName}`
      }
    } else {
      actionDescription = oldUserName
        ? `Снято назначение технического куратора: ${oldUserName}`
        : 'Снято назначение технического куратора'
    }

    // Получаем данные пользователя для аудита
    const userData = await getUserData(body.changed_by)

    await logAudit({
      ...userData,
      actionType: technicalCuratorId ? 'assign' : 'unassign',
      entityType: 'application',
      entityId: id,
      description: actionDescription,
      oldValues: oldTechnicalCuratorId ? { technical_curator_id: oldTechnicalCuratorId } : undefined,
      newValues: technicalCuratorId ? { technical_curator_id: technicalCuratorId } : undefined,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    // Получаем обновленную заявку с данными пользователя
    const { data: updatedApp, error: selectError } = await supabase
      .from('zakaz_applications')
      .select(`
        *,
        zakaz_nodes(id, code, presence_type),
        zakaz_addresses(id, city, street, house, building, address),
        assigned_user:zakaz_users!zakaz_applications_assigned_to_fkey(id, full_name, email, role),
        technical_curator_user:zakaz_users!zakaz_applications_technical_curator_id_fkey(id, full_name, email, role),
        created_by_user:zakaz_users!zakaz_applications_created_by_fkey(id, full_name, email, role),
        updated_by_user:zakaz_users!zakaz_applications_updated_by_fkey(id, full_name, email, role)
      `)
      .eq('id', id)
      .single()

    if (selectError) {
      console.error('Error fetching updated application:', selectError)
      return NextResponse.json(
        { error: 'Failed to fetch updated application' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      application: updatedApp,
      message: technicalCuratorId ? 'Technical curator assigned successfully' : 'Technical curator removed successfully',
    })
  } catch (error) {
    console.error('Error in technical curator assignment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
