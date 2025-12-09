import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSession, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { createDirectClient } from '@/lib/supabase-direct'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Валидация
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      )
    }

    // Проверяем пароль и получаем пользователя
    const user = await verifyPassword(email, password)

    if (!user) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      )
    }

    // Создаем сессию
    const sessionToken = await createSession(
      user.id,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    )

    // Обновляем дату последнего входа
    const supabase = createDirectClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('zakaz_users')
      .update({ legacy_last_login: new Date().toISOString() })
      .eq('id', user.id)

    // Создаем response с cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      message: 'Вход выполнен успешно',
    })

    // Устанавливаем cookie с сессией
    response.cookies.set({
      name: SESSION_COOKIE_OPTIONS.name,
      value: sessionToken,
      maxAge: SESSION_COOKIE_OPTIONS.maxAge,
      httpOnly: SESSION_COOKIE_OPTIONS.httpOnly,
      secure: SESSION_COOKIE_OPTIONS.secure,
      sameSite: SESSION_COOKIE_OPTIONS.sameSite,
      path: SESSION_COOKIE_OPTIONS.path,
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Ошибка при входе в систему' },
      { status: 500 }
    )
  }
}
