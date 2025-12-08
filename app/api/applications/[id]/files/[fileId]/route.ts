import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { getFilePath, deleteFile, fileExists } from '@/lib/file-upload'
import { FileAttachment } from '@/lib/types'
import { promises as fs } from 'fs'

// Базовый URL старого сервера для legacy-файлов
const LEGACY_FILE_BASE_URL = process.env.LEGACY_FILE_URL || 'http://zakaz.tomica.ru'

// Авторизация для старого сервера (Basic Auth)
const LEGACY_AUTH_USER = process.env.LEGACY_AUTH_USER || 'zakaz2'
const LEGACY_AUTH_PASS = process.env.LEGACY_AUTH_PASS || 'zakaz2zakaz'

// Создание заголовка авторизации
function getLegacyAuthHeader(): string {
  const credentials = Buffer.from(`${LEGACY_AUTH_USER}:${LEGACY_AUTH_PASS}`).toString('base64')
  return `Basic ${credentials}`
}

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
      .single()) as { data: (FileAttachment & { legacy_path?: string | null }) | null; error: unknown }

    if (error || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Проверка существования файла на диске
    const exists = await fileExists(applicationId, file.stored_filename)

    // Если файл не существует локально, проверяем legacy_path
    if (!exists) {
      if (file.legacy_path) {
        // Формируем URL к файлу на старом сервере
        // legacy_path может быть:
        // - полным URL: http://zakaz.tomica.ru/sites/default/files/...
        // - относительным путём: sites/default/files/...
        let legacyUrl: string
        if (file.legacy_path.startsWith('http://') || file.legacy_path.startsWith('https://')) {
          legacyUrl = file.legacy_path
        } else {
          // Убираем начальный слеш если есть
          const cleanPath = file.legacy_path.startsWith('/')
            ? file.legacy_path.slice(1)
            : file.legacy_path
          legacyUrl = `${LEGACY_FILE_BASE_URL}/${cleanPath}`
        }

        // Проксируем файл со старого сервера (с авторизацией)
        try {
          const legacyResponse = await fetch(legacyUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ZakazProxy/1.0)',
              'Authorization': getLegacyAuthHeader(),
            },
          })

          if (!legacyResponse.ok) {
            console.error(`Legacy file fetch failed: ${legacyResponse.status} ${legacyResponse.statusText}`)
            return NextResponse.json(
              { error: 'Legacy file not available', legacyUrl },
              { status: 404 }
            )
          }

          const buffer = Buffer.from(await legacyResponse.arrayBuffer())

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': file.mime_type || 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original_filename)}"`,
              'Content-Length': buffer.length.toString(),
              'X-Legacy-Source': 'true',
            },
          })
        } catch (proxyError) {
          console.error('Error proxying legacy file:', proxyError)
          return NextResponse.json(
            { error: 'Failed to fetch legacy file' },
            { status: 500 }
          )
        }
      }
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
    const auditTable = supabase.from('zakaz_audit_log') as unknown
    await (auditTable as { insert: (data: Record<string, unknown>) => Promise<unknown> }).insert({
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
