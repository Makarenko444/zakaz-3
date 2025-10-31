import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createDirectClient()
    const { id } = params
    const body = await request.json()

    // assigned_to может быть null (снять назначение) или UUID пользователя
    const assignedTo = body.assigned_to === '' ? null : body.assigned_to

    // Если назначается пользователь, проверяем что он существует
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
