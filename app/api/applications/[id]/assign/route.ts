import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id } = await params
    const body = await request.json()

    // assigned_to может быть null (снять назначение) или UUID пользователя
    const assignedTo = body.assigned_to === '' ? null : body.assigned_to

    // Получаем текущее значение assigned_to для логирования
    const { data: currentApp } = await supabase
      .from('zakaz_applications')
      .select('assigned_to, application_number')
      .eq('id', id)
      .single() as { data: { assigned_to: string | null; application_number: string } | null }

    const oldAssignedTo = currentApp?.assigned_to || null

    // Получаем имя старого исполнителя если был
    let oldUserName = null
    if (oldAssignedTo) {
      const { data: oldUser } = await supabase
        .from('zakaz_users')
        .select('full_name')
        .eq('id', oldAssignedTo)
        .single()
      oldUserName = oldUser?.full_name || null
    }

    // Получаем имя нового исполнителя и проверяем что он существует
    let newUserName = null
    if (assignedTo) {
      const { data: user, error: userError } = await supabase
        .from('zakaz_users')
        .select('id, full_name')
        .eq('id', assignedTo)
        .single()

      if (userError || !user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
      newUserName = user.full_name
    }

    // Обновляем назначенного пользователя
    const { error: updateError } = await supabase
      .from('zakaz_applications')
      .update({
        assigned_to: assignedTo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error assigning user to application:', updateError)
      return NextResponse.json(
        { error: 'Failed to assign user' },
        { status: 500 }
      )
    }

    // Логируем действие с именами пользователей
    let actionDescription = ''
    if (assignedTo) {
      if (oldAssignedTo) {
        actionDescription = `Исполнитель изменен с "${oldUserName || 'Неизвестно'}" на "${newUserName}"`
      } else {
        actionDescription = `Назначен исполнитель: ${newUserName}`
      }
    } else {
      actionDescription = oldUserName
        ? `Снято назначение с исполнителя: ${oldUserName}`
        : 'Снято назначение исполнителя'
    }

    await logAudit({
      userId: body.changed_by || undefined,
      actionType: assignedTo ? 'assign' : 'unassign',
      entityType: 'application',
      entityId: id,
      description: actionDescription,
      oldValues: oldAssignedTo ? { assigned_to: oldAssignedTo } : undefined,
      newValues: assignedTo ? { assigned_to: assignedTo } : undefined,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    // Получаем обновленную заявку с данными пользователя
    const { data: updatedApp, error: selectError } = await supabase
      .from('zakaz_applications')
      .select(`
        *,
        zakaz_addresses(street, house, entrance, comment),
        assigned_user:zakaz_users!assigned_to(id, full_name, email, role)
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
      message: assignedTo ? 'User assigned successfully' : 'Assignment removed successfully',
    })
  } catch (error) {
    console.error('Error in user assignment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
