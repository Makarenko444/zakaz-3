import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession, hashPassword } from '@/lib/session'

// PATCH - обновить пользователя
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { email, full_name, phone, role, active, password } = body

    const supabase = createDirectClient()

    const updateData: Record<string, unknown> = {}
    if (email !== undefined) updateData.email = email
    if (full_name !== undefined) updateData.full_name = full_name
    if (phone !== undefined) updateData.phone = phone || null
    if (role !== undefined) updateData.role = role
    if (active !== undefined) updateData.active = active

    // Если передан новый пароль, хешируем его
    if (password) {
      updateData.password_hash = hashPassword(password)
    }

    const table = supabase.from('zakaz_users') as unknown
    const updateBuilder = (table as { update: (data: Record<string, unknown>) => unknown }).update(updateData) as unknown
    const eqBuilder = (updateBuilder as { eq: (col: string, val: string) => unknown }).eq('id', id) as unknown
    const selectBuilder = (eqBuilder as { select: () => unknown }).select() as unknown
    const result = await (selectBuilder as { single: () => Promise<unknown> }).single()
    const { data, error } = result as { data: unknown; error: unknown }

    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Error in admin users PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - удалить пользователя (мягкое удаление - деактивация)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const supabase = createDirectClient()

    // Деактивируем пользователя вместо удаления
    const table = supabase.from('zakaz_users') as unknown
    const updateBuilder = (table as { update: (data: Record<string, unknown>) => unknown }).update({ active: false }) as unknown
    const eqBuilder = (updateBuilder as { eq: (col: string, val: string) => unknown }).eq('id', id) as unknown
    const selectBuilder = (eqBuilder as { select: () => unknown }).select() as unknown
    const result = await (selectBuilder as { single: () => Promise<unknown> }).single()
    const { data, error } = result as { data: unknown; error: unknown }

    if (error) {
      console.error('Error deleting user:', error)
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Error in admin users DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
