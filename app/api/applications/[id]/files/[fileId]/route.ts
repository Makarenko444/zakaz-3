import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { getFilePath, deleteFile, fileExists, ensureUploadDirExists } from '@/lib/file-upload'
import { FileAttachment } from '@/lib/types'
import { promises as fs } from 'fs'

// Базовый URL старого сервера для legacy-файлов
const LEGACY_FILE_BASE_URL = process.env.LEGACY_FILE_URL || 'http://zakaz.tomica.ru'

// Авторизация для старого сервера (Basic Auth)
const LEGACY_AUTH_USER = process.env.LEGACY_AUTH_USER || 'zakaz2'
const LEGACY_AUTH_PASS = process.env.LEGACY_AUTH_PASS || 'zakaz2zakaz'

// Peer-сервер для синхронизации файлов (zakaz2 ↔ zakaz3)
// На zakaz2 указывает на zakaz3, и наоборот
const PEER_SERVER_URL = process.env.PEER_SERVER_URL || ''

// Секретный ключ для межсерверной авторизации
const FILE_SYNC_SECRET = process.env.FILE_SYNC_SECRET || ''

// Создание заголовка авторизации
function getLegacyAuthHeader(): string {
  const credentials = Buffer.from(`${LEGACY_AUTH_USER}:${LEGACY_AUTH_PASS}`).toString('base64')
  return `Basic ${credentials}`
}

// Правильное кодирование URL с русскими символами
function encodeLegacyUrl(urlOrPath: string): string {
  // Если это уже полный URL
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    try {
      const url = new URL(urlOrPath)
      // Перекодируем путь, сохраняя уже закодированные символы
      const decodedPath = decodeURIComponent(url.pathname)
      url.pathname = decodedPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
      return url.toString()
    } catch {
      return urlOrPath
    }
  }

  // Относительный путь
  const cleanPath = urlOrPath.startsWith('/') ? urlOrPath.slice(1) : urlOrPath
  try {
    const decoded = decodeURIComponent(cleanPath)
    const encoded = decoded.split('/').map(segment => encodeURIComponent(segment)).join('/')
    return `${LEGACY_FILE_BASE_URL}/${encoded}`
  } catch {
    const encoded = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
    return `${LEGACY_FILE_BASE_URL}/${encoded}`
  }
}

// Проверка валидности сервисного токена для межсерверных запросов
function isValidFileSyncRequest(request: NextRequest): boolean {
  if (!FILE_SYNC_SECRET) return false
  const syncSecret = request.headers.get('X-File-Sync-Secret')
  return syncSecret === FILE_SYNC_SECRET
}

// Скачивание файла с peer-сервера (zakaz2 ↔ zakaz3) и кэширование локально
async function fetchFromPeerServer(
  applicationId: string,
  fileId: string,
  storedFilename: string
): Promise<{ buffer: Buffer; cached: boolean } | null> {
  // Если peer-сервер не настроен или нет секрета, пропускаем
  if (!PEER_SERVER_URL || !FILE_SYNC_SECRET) {
    return null
  }

  const peerUrl = `${PEER_SERVER_URL}/api/applications/${applicationId}/files/${fileId}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    let peerResponse: Response
    try {
      peerResponse = await fetch(peerUrl, {
        headers: {
          'User-Agent': 'ZakazFileSyncAgent/1.0',
          'X-File-Sync-Secret': FILE_SYNC_SECRET,
        },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!peerResponse.ok) {
      // Файл не найден на peer-сервере - это нормально
      if (peerResponse.status === 404) {
        return null
      }
      console.error(`Peer server fetch failed: ${peerResponse.status} ${peerResponse.statusText}`)
      return null
    }

    const buffer = Buffer.from(await peerResponse.arrayBuffer())

    // Кэшируем файл локально для будущих запросов
    try {
      await ensureUploadDirExists(applicationId)
      const filePath = getFilePath(applicationId, storedFilename)
      await fs.writeFile(filePath, buffer)
      console.log(`File cached from peer server: ${filePath}`)
      return { buffer, cached: true }
    } catch (cacheError) {
      console.error('Error caching file from peer server:', cacheError)
      // Даже если не удалось кэшировать, возвращаем буфер
      return { buffer, cached: false }
    }
  } catch (error) {
    // Таймаут или сетевая ошибка - не критично
    console.error('Error fetching from peer server:', error)
    return null
  }
}

// GET /api/applications/[id]/files/[fileId] - Скачивание файла
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const params = await context.params
    const { id: applicationId, fileId } = params

    // Флаг для межсерверного запроса (не проверяем сессию пользователя)
    const isFileSyncRequest = isValidFileSyncRequest(request)

    // Проверка аутентификации (пропускаем для межсерверных запросов)
    if (!isFileSyncRequest) {
      const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
      const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
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

    // Если файл не существует локально, пробуем получить с других серверов
    if (!exists) {
      // 1. Сначала проверяем peer-сервер (zakaz2 ↔ zakaz3)
      // Но НЕ для межсерверных запросов, чтобы избежать бесконечной рекурсии!
      if (!isFileSyncRequest) {
        const peerResult = await fetchFromPeerServer(applicationId, fileId, file.stored_filename)
        if (peerResult) {
          return new NextResponse(new Uint8Array(peerResult.buffer), {
            status: 200,
            headers: {
              'Content-Type': file.mime_type || 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original_filename)}"`,
              'Content-Length': peerResult.buffer.length.toString(),
              'X-Peer-Source': 'true',
              'X-Peer-Cached': peerResult.cached ? 'true' : 'false',
            },
          })
        }
      }

      // 2. Затем проверяем legacy-сервер (zakaz.tomica.ru)
      if (file.legacy_path) {
        // Формируем URL к файлу на старом сервере с правильным кодированием
        const legacyUrl = encodeLegacyUrl(file.legacy_path)

        // Проксируем файл со старого сервера (с авторизацией, таймаут 30 сек)
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000)

          let legacyResponse: Response
          try {
            legacyResponse = await fetch(legacyUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZakazProxy/1.0)',
                'Authorization': getLegacyAuthHeader(),
              },
              signal: controller.signal,
            })
          } finally {
            clearTimeout(timeoutId)
          }

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
