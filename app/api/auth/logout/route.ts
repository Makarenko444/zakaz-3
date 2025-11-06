import { NextRequest, NextResponse } from 'next/server'
import { deleteSession, SESSION_COOKIE_OPTIONS } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value

    if (sessionToken) {
      await deleteSession(sessionToken)
    }

    const response = NextResponse.json({ message: 'Выход выполнен успешно' })

    // Удаляем cookie
    response.cookies.delete(SESSION_COOKIE_OPTIONS.name)

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Ошибка при выходе' },
      { status: 500 }
    )
  }
}
