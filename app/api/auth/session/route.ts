import { NextRequest, NextResponse } from 'next/server'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value

    if (!sessionToken) {
      return NextResponse.json({ user: null }, { status: 200 })
    }

    const user = await getUserBySessionToken(sessionToken)

    if (!user) {
      const response = NextResponse.json({ user: null }, { status: 200 })
      response.cookies.delete(SESSION_COOKIE_OPTIONS.name)
      return response
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
      },
    })
  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json(
      { error: 'Ошибка проверки сессии' },
      { status: 500 }
    )
  }
}
