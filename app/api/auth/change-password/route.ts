import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession, hashPassword } from '@/lib/session'

// POST - сменить пароль текущего пользователя
export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword
    } = body

    // Валидация
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Требуется текущий и новый пароль' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Новый пароль должен быть не менее 6 символов' },
        { status: 400 }
      )
    }

    const supabase = createDirectClient()

    // Проверяем текущий пароль
    const { data: user, error: userError } = await supabase
      .from('zakaz_users')
      .select('id, password_hash')
      .eq('id', session.user.id)
      .single() as { data: { id: string; password_hash: string } | null; error: unknown }

    if (userError || !user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    const currentPasswordHash = hashPassword(currentPassword)
    if (user.password_hash !== currentPasswordHash) {
      return NextResponse.json(
        { error: 'Неверный текущий пароль' },
        { status: 400 }
      )
    }

    // Обновляем пароль
    const newPasswordHash = hashPassword(newPassword)
    const { error: updateError } = await supabase
      .from('zakaz_users')
      .update({ password_hash: newPasswordHash } as never)
      .eq('id', session.user.id)

    if (updateError) {
      console.error('Error updating password:', updateError)
      return NextResponse.json({ error: 'Ошибка обновления пароля' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Пароль успешно изменён' })
  } catch (error) {
    console.error('Error in change-password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
