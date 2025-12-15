import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { saveFile, validateFile } from '@/lib/file-upload'

// POST /api/work-orders/[id]/files - Загрузка файла к наряду
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const workOrderId = params.id

    // Проверка аутентификации
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createDirectClient()

    // Проверка существования наряда и получение application_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workOrder, error: woError } = await (supabase.from as any)('zakaz_work_orders')
      .select('id, application_id')
      .eq('id', workOrderId)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    // Получение формы
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const description = formData.get('description') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Валидация файла
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Сохранение файла на диск (используем application_id для организации папок)
    const { storedFilename } = await saveFile(workOrder.application_id, file)

    // Сохранение метаданных в БД с привязкой к наряду и заявке
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fileRecord, error: insertError } = await (supabase.from as any)('zakaz_files')
      .insert({
        application_id: workOrder.application_id,
        work_order_id: workOrderId,
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

// GET /api/work-orders/[id]/files - Получение списка файлов наряда
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const workOrderId = params.id

    // Проверка аутентификации
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createDirectClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: files, error } = await (supabase.from as any)('zakaz_files')
      .select(`
        *,
        uploaded_by_user:zakaz_users!fk_user(id, full_name, email)
      `)
      .eq('work_order_id', workOrderId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching files:', error)
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
    }

    return NextResponse.json({ files: files || [] }, { status: 200 })
  } catch (error) {
    console.error('Error fetching files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
