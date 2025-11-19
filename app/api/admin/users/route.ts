import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession, hashPassword } from '@/lib/session'

// GET - получить всех пользователей (включая неактивных)
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createDirectClient()
    const { data, error } = await supabase
      .from('zakaz_users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    return NextResponse.json({ users: data || [] })
  } catch (error) {
    console.error('Error in admin users GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - создать нового пользователя
export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, full_name, phone, role, password } = body

    if (!email || !full_name || !role || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Нормализуем email (приводим к нижнему регистру и убираем пробелы)
    const normalizedEmail = email.trim().toLowerCase()

    // Хешируем пароль
    const hashedPassword = hashPassword(password)

    const supabase = createDirectClient()

    // Проверяем, не существует ли уже пользователь с таким email
    const { data: existingUser, error: checkError } = await supabase
      .from('zakaz_users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    // Игнорируем ошибку "нет записей" - это нормально при проверке
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing user:', checkError)
      return NextResponse.json({ error: 'Failed to check existing user' }, { status: 500 })
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Создаем пользователя
    const table = supabase.from('zakaz_users') as unknown
    const insertBuilder = (table as { insert: (data: Record<string, unknown>) => unknown }).insert({
      email: normalizedEmail,
      full_name,
      phone: phone || null,
      role,
      password_hash: hashedPassword,
      active: true,
    }) as unknown
    const selectBuilder = (insertBuilder as { select: () => unknown }).select() as unknown
    const result = await (selectBuilder as { single: () => Promise<unknown> }).single()
    const { data, error } = result as { data: unknown; error: unknown }

    if (error) {
      console.error('Error creating user:', error)
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Error in admin users POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
