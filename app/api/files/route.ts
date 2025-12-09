import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface FileRow {
  id: string
  application_id: string
  original_filename: string
  stored_filename: string | null
  file_size: number
  mime_type: string
  uploaded_by: string | null
  uploaded_at: string
  description: string | null
  legacy_id: number | null
  legacy_path: string | null
  application?: {
    application_number: number
    customer_fullname: string
  }
  uploader?: {
    full_name: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortBy = searchParams.get('sort_by') || 'uploaded_at'
    const sortDir = searchParams.get('sort_dir') || 'desc'
    const typeFilter = searchParams.get('type')

    // Валидация полей сортировки
    const allowedSortFields = ['uploaded_at', 'original_filename', 'file_size']
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'uploaded_at'
    const validSortDir = sortDir === 'asc' || sortDir === 'desc' ? sortDir : 'desc'

    let query = supabase
      .from('zakaz_files')
      .select(`
        *,
        application:zakaz_applications!application_id(application_number, customer_fullname),
        uploader:zakaz_users!uploaded_by(full_name)
      `, { count: 'exact' })
      .order(validSortBy, { ascending: validSortDir === 'asc' })

    // Поиск по имени файла
    if (search) {
      query = query.ilike('original_filename', `%${search}%`)
    }

    // Фильтр по типу файла
    if (typeFilter) {
      switch (typeFilter) {
        case 'images':
          query = query.like('mime_type', 'image/%')
          break
        case 'pdf':
          query = query.eq('mime_type', 'application/pdf')
          break
        case 'documents':
          query = query.or('mime_type.ilike.%word%,mime_type.ilike.%document%')
          break
        case 'spreadsheets':
          query = query.or('mime_type.ilike.%excel%,mime_type.ilike.%spreadsheet%')
          break
        case 'archives':
          query = query.or('mime_type.ilike.%zip%,mime_type.ilike.%archive%,mime_type.ilike.%rar%')
          break
        case 'other':
          query = query
            .not('mime_type', 'like', 'image/%')
            .neq('mime_type', 'application/pdf')
            .not('mime_type', 'ilike', '%word%')
            .not('mime_type', 'ilike', '%document%')
            .not('mime_type', 'ilike', '%excel%')
            .not('mime_type', 'ilike', '%spreadsheet%')
            .not('mime_type', 'ilike', '%zip%')
            .not('mime_type', 'ilike', '%archive%')
            .not('mime_type', 'ilike', '%rar%')
          break
      }
    }

    // Пагинация
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch files', details: error.message },
        { status: 500 }
      )
    }

    const files = (data || []) as FileRow[]

    return NextResponse.json({
      files,
      total: count || 0,
      page,
      limit,
      pages: count ? Math.ceil(count / limit) : 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
