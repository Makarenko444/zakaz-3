// Утилиты авторизации для API endpoints

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySessionToken } from './session'
import { User } from './types'

const SESSION_COOKIE_NAME = 'zakaz_session'

/**
 * Получить текущего пользователя из сессии (для API routes)
 */
export async function getCurrentUserFromSession(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionToken) {
      return null
    }

    return await getUserBySessionToken(sessionToken)
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Проверить что пользователь авторизован и является администратором
 * Возвращает пользователя или NextResponse с ошибкой
 */
export async function requireAdmin(): Promise<User | NextResponse> {
  const user = await getCurrentUserFromSession()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    )
  }

  return user
}

/**
 * Проверить что пользователь авторизован
 * Возвращает пользователя или NextResponse с ошибкой
 */
export async function requireAuth(): Promise<User | NextResponse> {
  const user = await getCurrentUserFromSession()

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return user
}
