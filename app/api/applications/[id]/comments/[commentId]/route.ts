import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'

// PATCH - Обновить комментарий
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id: applicationId, commentId } = await params
    const body = await request.json()

    // Проверка аутентификации
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Валидация
    if (!body.comment || !body.comment.trim()) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      )
    }

    // Получаем существующий комментарий
    const { data: existingComment, error: fetchError } = await supabase
      .from('zakaz_application_comments')
      .select('*')
      .eq('id', commentId)
      .eq('application_id', applicationId)
      .single() as { data: { user_id: string } | null; error: unknown }

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Проверка прав: редактировать может только автор или админ
    if (existingComment.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Обновляем комментарий
    const updateData = {
      comment: body.comment.trim(),
      updated_at: new Date().toISOString(),
    }

    const table = supabase.from('zakaz_application_comments') as unknown
    const builder = (table as { update: (data: Record<string, unknown>) => unknown }).update(updateData) as unknown
    const filtered = (builder as { eq: (col: string, val: string) => unknown }).eq('id', commentId) as unknown
    const selector = (filtered as { select: () => unknown }).select() as unknown
    const query = (selector as { single: () => Promise<unknown> }).single()
    const result = await query
    const { data, error } = result as { data: unknown; error: unknown }

    if (error) {
      console.error('Error updating comment:', error)
      return NextResponse.json(
        { error: 'Failed to update comment' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { comment: data, message: 'Comment updated successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in comment update API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Удалить комментарий
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id: applicationId, commentId } = await params

    // Проверка аутентификации
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем существующий комментарий
    const { data: existingComment, error: fetchError } = await supabase
      .from('zakaz_application_comments')
      .select('*')
      .eq('id', commentId)
      .eq('application_id', applicationId)
      .single() as { data: { user_id: string } | null; error: unknown }

    if (fetchError || !existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Проверка прав: удалять может только автор или админ
    if (existingComment.user_id !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Удаляем комментарий
    const { error: deleteError } = await supabase
      .from('zakaz_application_comments')
      .delete()
      .eq('id', commentId)

    if (deleteError) {
      console.error('Error deleting comment:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete comment' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Comment deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in comment delete API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
