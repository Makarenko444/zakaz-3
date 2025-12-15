import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface CommentRow {
  id: string
  application_id: string
  user_id: string | null
  user_name: string
  user_email: string | null
  comment: string
  reply_to_comment_id: string | null
  created_at: string
  updated_at: string
  application?: {
    id: string
    application_number: number
    customer_fullname: string
    customer_phone: string
    status: string
    city: string
    street_and_house: string | null
    address_details: string | null
  }
  replied_comment?: {
    id: string
    user_name: string
    comment: string
  } | null
  files_count?: number
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortDir = searchParams.get('sort_dir') || 'desc'
    const userId = searchParams.get('user_id')
    const applicationId = searchParams.get('application_id')

    // Валидация полей сортировки
    const allowedSortFields = ['created_at', 'updated_at', 'user_name']
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at'
    const validSortDir = sortDir === 'asc' || sortDir === 'desc' ? sortDir : 'desc'

    let query = supabase
      .from('zakaz_application_comments')
      .select(`
        *,
        application:zakaz_applications!application_id(
          id,
          application_number,
          customer_fullname,
          customer_phone,
          status,
          city,
          street_and_house,
          address_details
        ),
        replied_comment:zakaz_application_comments!reply_to_comment_id(
          id,
          user_name,
          comment
        )
      `, { count: 'exact' })
      .order(validSortBy, { ascending: validSortDir === 'asc' })

    // Фильтр по пользователю
    if (userId) {
      query = query.eq('user_id', userId)
    }

    // Фильтр по заявке
    if (applicationId) {
      query = query.eq('application_id', applicationId)
    }

    // Поиск по тексту комментария или имени пользователя
    if (search) {
      query = query.or(`comment.ilike.%${search}%,user_name.ilike.%${search}%`)
    }

    // Пагинация
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query as {
      data: CommentRow[] | null
      error: { message: string } | null
      count: number | null
    }

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch comments', details: error.message },
        { status: 500 }
      )
    }

    // Получаем количество файлов для каждого комментария
    const commentIds = (data || []).map(c => c.id)
    let filesCountMap: Record<string, number> = {}

    if (commentIds.length > 0) {
      const { data: filesData } = await supabase
        .from('zakaz_files')
        .select('comment_id')
        .in('comment_id', commentIds) as { data: { comment_id: string | null }[] | null }

      if (filesData) {
        filesCountMap = filesData.reduce((acc, file) => {
          if (file.comment_id) {
            acc[file.comment_id] = (acc[file.comment_id] || 0) + 1
          }
          return acc
        }, {} as Record<string, number>)
      }
    }

    const comments = (data || []).map(comment => ({
      ...comment,
      files_count: filesCountMap[comment.id] || 0
    }))

    // Получаем статистику
    const { count: totalComments } = await supabase
      .from('zakaz_application_comments')
      .select('*', { count: 'exact', head: true })

    // Комментарии за последние 24 часа
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const { count: recentComments } = await supabase
      .from('zakaz_application_comments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString())

    // Комментарии за последние 7 дней
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { count: weekComments } = await supabase
      .from('zakaz_application_comments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString())

    return NextResponse.json({
      comments,
      total: count || 0,
      page,
      limit,
      pages: count ? Math.ceil(count / limit) : 0,
      stats: {
        totalComments: totalComments || 0,
        recentComments: recentComments || 0,
        weekComments: weekComments || 0
      }
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
