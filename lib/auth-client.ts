// Клиентские утилиты для работы с авторизацией (новая система без Supabase Auth)

import { User } from './types'

// Получить текущего пользователя из сессии
export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.user || null
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

// Выход из системы
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch (error) {
    console.error('Error signing out:', error)
    throw error
  }
}
