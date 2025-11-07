// Утилиты для работы с сессиями (простая авторизация без Supabase Auth)

import { createDirectClient } from './supabase-direct'
import { User } from './types'
import crypto from 'crypto'

const SESSION_COOKIE_NAME = 'zakaz_session'
const SESSION_DURATION_DAYS = 7

// Генерация токена сессии
export function generateSessionToken(): string {
  return crypto.randomUUID()
}

// Создание новой сессии в БД
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const supabase = createDirectClient()
  const sessionToken = generateSessionToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  const table = supabase.from('zakaz_sessions') as unknown
  const result = await (table as { insert: (data: Record<string, unknown>) => Promise<unknown> }).insert({
    user_id: userId,
    session_token: sessionToken,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    expires_at: expiresAt.toISOString(),
  })
  const { error } = result as { error: unknown }

  if (error) {
    console.error('Error creating session:', error)
    throw new Error('Failed to create session')
  }

  return sessionToken
}

// Получение пользователя по токену сессии
export async function getUserBySessionToken(
  sessionToken: string
): Promise<User | null> {
  const supabase = createDirectClient()

  // Получаем сессию
  const { data: session, error: sessionError } = await supabase
    .from('zakaz_sessions')
    .select('user_id, expires_at')
    .eq('session_token', sessionToken)
    .single() as { data: { user_id: string; expires_at: string } | null; error: unknown }

  if (sessionError || !session) {
    return null
  }

  // Проверяем не истекла ли сессия
  if (new Date(session.expires_at) < new Date()) {
    // Удаляем истекшую сессию
    const deleteTable = supabase.from('zakaz_sessions') as unknown
    await (deleteTable as { delete: () => { eq: (col: string, val: string) => Promise<unknown> } }).delete().eq('session_token', sessionToken)
    return null
  }

  // Обновляем last_activity
  const updateTable = supabase.from('zakaz_sessions') as unknown
  const updateBuilder = (updateTable as { update: (data: Record<string, unknown>) => unknown }).update({ last_activity: new Date().toISOString() }) as unknown
  await (updateBuilder as { eq: (col: string, val: string) => Promise<unknown> }).eq('session_token', sessionToken)

  // Получаем пользователя
  const { data: user, error: userError } = await supabase
    .from('zakaz_users')
    .select('*')
    .eq('id', session.user_id)
    .eq('active', true)
    .single()

  if (userError || !user) {
    return null
  }

  return user as User
}

// Удаление сессии (logout)
export async function deleteSession(sessionToken: string): Promise<void> {
  const supabase = createDirectClient()
  const table = supabase.from('zakaz_sessions') as unknown
  await (table as { delete: () => { eq: (col: string, val: string) => Promise<unknown> } }).delete().eq('session_token', sessionToken)
}

// Удаление всех сессий пользователя
export async function deleteAllUserSessions(userId: string): Promise<void> {
  const supabase = createDirectClient()
  const table = supabase.from('zakaz_sessions') as unknown
  await (table as { delete: () => { eq: (col: string, val: string) => Promise<unknown> } }).delete().eq('user_id', userId)
}

// Проверка пароля (простое сравнение - bcrypt будет добавлен позже если нужно)
export async function verifyPassword(
  email: string,
  password: string
): Promise<User | null> {
  const supabase = createDirectClient()

  const { data: user, error } = await supabase
    .from('zakaz_users')
    .select('*')
    .eq('email', email)
    .eq('active', true)
    .single() as { data: User & { password_hash?: string } | null; error: unknown }

  console.log('verifyPassword DEBUG:', {
    email,
    error: error ? JSON.stringify(error, null, 2) : null,
    userExists: !!user,
    hasPasswordHash: user ? 'password_hash' in user : false,
    passwordHashLength: user?.password_hash?.length
  })

  if (error || !user) {
    console.log('verifyPassword: User not found or error')
    return null
  }

  // Проверяем пароль
  // Временно используем простое сравнение хешей
  // В production нужно использовать bcrypt.compare()
  const passwordHash = hashPassword(password)

  console.log('verifyPassword: Comparing hashes', {
    dbHash: user.password_hash?.substring(0, 20),
    calculatedHash: passwordHash.substring(0, 20),
    match: user.password_hash === passwordHash
  })

  if (user.password_hash === passwordHash) {
    console.log('verifyPassword: Password matches!')
    return user as User
  }

  console.log('verifyPassword: Password does not match')
  return null
}

// Простое хеширование пароля (для демо)
// В production используйте bcrypt!
function hashPassword(password: string): string {
  // Временная реализация - простой SHA256
  // TODO: Заменить на bcrypt для production
  return crypto.createHash('sha256').update(password).digest('hex')
}

// Константа для cookie
export const SESSION_COOKIE_OPTIONS = {
  name: SESSION_COOKIE_NAME,
  maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60, // в секундах
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}
