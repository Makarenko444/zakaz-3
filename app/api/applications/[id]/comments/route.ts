import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'

// Получить комментарии заявки
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('zakaz_application_comments')
      .select('*')
      .eq('application_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching comments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 }
      )
    }

    return NextResponse.json({ comments: data || [] })
  } catch (error) {
    console.error('Error in comments API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Добавить комментарий
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id } = await params
    const body = await request.json()

    // Валидация
    if (!body.comment || !body.comment.trim()) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      )
    }

    if (!body.user_name) {
      return NextResponse.json(
        { error: 'User name is required' },
        { status: 400 }
      )
    }

    const commentData = {
      application_id: id,
      user_id: body.user_id || null,
      user_name: body.user_name,
      user_email: body.user_email || null,
      comment: body.comment.trim(),
    }

    const { data, error } = await supabase
      .from('zakaz_application_comments')
      .insert(commentData)
      .select()
      .single()

    if (error) {
      console.error('Error creating comment:', error)
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      )
    }

    // Не логируем комментарии в audit_log - они и так видны в разделе комментариев

    return NextResponse.json(
      { comment: data, message: 'Comment created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in comments API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
