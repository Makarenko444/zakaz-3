import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { saveFile, validateFile } from '@/lib/file-upload'

// POST /api/applications/[id]/files - Загрузка файла
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const applicationId = params.id

    // Проверка аутентификации
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверка существования заявки
    const supabase = createDirectClient()
    const { data: application, error: appError } = await supabase
      .from('zakaz_applications')
      .select('id')
      .eq('id', applicationId)
      .single()

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Получение формы
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const commentId = formData.get('comment_id') as string | null
    const description = formData.get('description') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Валидация файла
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Если указан comment_id, проверим что комментарий существует и принадлежит этой заявке
    if (commentId && commentId !== 'null') {
      console.log('🔍 Checking comment:', { commentId, applicationId, commentIdType: typeof commentId })
      const { data: comment, error: commentError } = await supabase
        .from('zakaz_comments')
        .select('id, application_id')
        .eq('id', commentId)
        .eq('application_id', applicationId)
        .single()

      console.log('📊 Comment query result:', { comment, commentError, hasComment: !!comment })

      if (commentError || !comment) {
        console.error('❌ Comment validation failed:', { commentError, comment, commentId, applicationId })
        return NextResponse.json(
          { error: 'Comment not found or does not belong to this application' },
          { status: 404 }
        )
      }
      console.log('✅ Comment validated successfully')
    }

    // Сохранение файла на диск
    const { storedFilename } = await saveFile(applicationId, file)

    // Сохранение метаданных в БД
    const { data: fileRecord, error: insertError } = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from('zakaz_files') as any
    )
      .insert({
        application_id: applicationId,
        comment_id: commentId,
        original_filename: file.name,
        stored_filename: storedFilename,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
        description: description || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting file record:', insertError)
      return NextResponse.json({ error: 'Failed to save file metadata' }, { status: 500 })
    }

    return NextResponse.json({ file: fileRecord }, { status: 201 })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/applications/[id]/files - Получение списка файлов
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const applicationId = params.id

    // Проверка аутентификации
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получение параметров
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('comment_id')

    const supabase = createDirectClient()

    // Базовый запрос
    let query = supabase
      .from('zakaz_files')
      .select(
        `
        *,
        uploaded_by_user:zakaz_users!fk_user(id, full_name, email)
      `
      )
      .eq('application_id', applicationId)
      .order('uploaded_at', { ascending: false })

    // Фильтр по comment_id если указан
    if (commentId && commentId !== 'null') {
      query = query.eq('comment_id', commentId)
    } else if (commentId === 'null') {
      // Если передан параметр comment_id=null, то показываем только файлы без комментария
      query = query.is('comment_id', null)
    }

    const { data: files, error } = await query

    if (error) {
      console.error('Error fetching files:', error)
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
    }

    return NextResponse.json({ files }, { status: 200 })
  } catch (error) {
    console.error('Error fetching files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
