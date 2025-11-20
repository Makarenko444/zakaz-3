import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { getFilePath, deleteFile, fileExists } from '@/lib/file-upload'
import { FileAttachment } from '@/lib/types'
import { promises as fs } from 'fs'

// GET /api/applications/[id]/files/[fileId] - Скачивание файла
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const params = await context.params
    const { id: applicationId, fileId } = params

    // Проверка аутентификации
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получение информации о файле из БД
    const supabase = createDirectClient()
    const { data: file, error } = (await supabase
      .from('zakaz_files')
      .select('*')
      .eq('id', fileId)
      .eq('application_id', applicationId)
      .single()) as { data: FileAttachment | null; error: unknown }

    if (error || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Проверка существования файла на диске
    const exists = await fileExists(applicationId, file.stored_filename)
    if (!exists) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
    }

    // Чтение файла
    const filePath = getFilePath(applicationId, file.stored_filename)
    const fileBuffer = await fs.readFile(filePath)

    // Отправка файла
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original_filename)}"`,
        'Content-Length': file.file_size.toString(),
      },
    })
  } catch (error) {
    console.error('Error downloading file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/applications/[id]/files/[fileId] - Удаление файла
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const params = await context.params
    const { id: applicationId, fileId } = params

    // Проверка аутентификации
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createDirectClient()

    // Получение информации о файле
    const { data: file, error: fetchError } = (await supabase
      .from('zakaz_files')
      .select('*')
      .eq('id', fileId)
      .eq('application_id', applicationId)
      .single()) as { data: FileAttachment | null; error: unknown }

    if (fetchError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Проверка прав: удалять может только загрузивший или админ
    if (file.uploaded_by !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Удаление записи из БД
    const { error: deleteError } = await supabase
      .from('zakaz_files')
      .delete()
      .eq('id', fileId)

    if (deleteError) {
      console.error('Error deleting file record:', deleteError)
      return NextResponse.json({ error: 'Failed to delete file metadata' }, { status: 500 })
    }

    // Удаление файла с диска
    await deleteFile(applicationId, file.stored_filename)

    // Логируем удаление файла
    await supabase
      .from('zakaz_audit_log')
      .insert({
        user_id: user.id,
        user_name: user.full_name,
        user_email: user.email,
        action_type: 'delete_file',
        entity_type: 'application',
        entity_id: applicationId,
        description: 'Удален файл',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      })

    return NextResponse.json({ message: 'File deleted successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
