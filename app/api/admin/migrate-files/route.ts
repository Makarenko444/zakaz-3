import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { ensureUploadDirExists, getFilePath } from '@/lib/file-upload'
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
      // Если URL невалидный, пробуем закодировать как есть
      return urlOrPath
    }
  }

  // Относительный путь
  const cleanPath = urlOrPath.startsWith('/') ? urlOrPath.slice(1) : urlOrPath
  // Декодируем (на случай если уже закодировано) и кодируем заново
  try {
    const decoded = decodeURIComponent(cleanPath)
    const encoded = decoded.split('/').map(segment => encodeURIComponent(segment)).join('/')
    return `${LEGACY_FILE_BASE_URL}/${encoded}`
  } catch {
    // Если декодирование не удалось, кодируем как есть
    const encoded = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
    return `${LEGACY_FILE_BASE_URL}/${encoded}`
  }
}

interface LegacyFile {
  id: string
  application_id: string
  legacy_path: string
  stored_filename: string
  original_filename: string
}

// GET /api/admin/migrate-files - Получить статистику миграции файлов
export async function GET(request: NextRequest) {
  try {
    // Проверка аутентификации и прав админа
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const supabase = createDirectClient()

    // Получаем все файлы с legacy_path
    const { data: allLegacyFiles, error } = await supabase
      .from('zakaz_files')
      .select('id, application_id, legacy_path, stored_filename, original_filename')
      .not('legacy_path', 'is', null)
      .order('uploaded_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch files', details: error.message }, { status: 500 })
    }

    const files = (allLegacyFiles || []) as LegacyFile[]

    // Проверяем, какие файлы уже мигрированы (существуют локально)
    // Ограничиваем параллельность до 50 файлов за раз чтобы не перегружать FS
    const BATCH_SIZE = 50
    const migrationStatus: {
      id: string
      application_id: string
      original_filename: string
      legacy_path: string
      legacy_url: string
      migrated: boolean
    }[] = []

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const filePath = getFilePath(file.application_id, file.stored_filename)
          let exists = false
          try {
            await fs.access(filePath)
            exists = true
          } catch {
            exists = false
          }

          // Формируем URL для legacy-файла
          const legacyUrl = file.legacy_path ? encodeLegacyUrl(file.legacy_path) : ''

          return {
            id: file.id,
            application_id: file.application_id,
            original_filename: file.original_filename,
            legacy_path: file.legacy_path,
            legacy_url: legacyUrl,
            migrated: exists,
          }
        })
      )
      migrationStatus.push(...batchResults)
    }

    const totalFiles = migrationStatus.length
    const migratedFiles = migrationStatus.filter((f) => f.migrated).length
    const pendingFiles = migrationStatus.filter((f) => !f.migrated)

    return NextResponse.json({
      total: totalFiles,
      migrated: migratedFiles,
      pending: pendingFiles.length,
      pendingFiles: pendingFiles.slice(0, 50), // Показываем первые 50 ожидающих
    })
  } catch (error) {
    console.error('Error getting migration status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/migrate-files - Запустить миграцию файлов
export async function POST(request: NextRequest) {
  try {
    // Проверка аутентификации и прав админа
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { fileIds, limit = 10 } = body as { fileIds?: string[]; limit?: number }

    const supabase = createDirectClient()

    // Получаем файлы для миграции
    let query = supabase
      .from('zakaz_files')
      .select('id, application_id, legacy_path, stored_filename, original_filename, mime_type')
      .not('legacy_path', 'is', null)

    if (fileIds && fileIds.length > 0) {
      query = query.in('id', fileIds)
    }

    query = query.limit(limit)

    const { data: files, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch files', details: error.message }, { status: 500 })
    }

    const legacyFiles = (files || []) as (LegacyFile & { mime_type: string })[]

    const results: {
      id: string
      filename: string
      success: boolean
      error?: string
      skipped?: boolean
    }[] = []

    for (const file of legacyFiles) {
      try {
        // Проверяем, существует ли файл локально
        const filePath = getFilePath(file.application_id, file.stored_filename)
        let exists = false
        try {
          await fs.access(filePath)
          exists = true
        } catch {
          exists = false
        }

        if (exists) {
          results.push({
            id: file.id,
            filename: file.original_filename,
            success: true,
            skipped: true,
          })
          continue
        }

        // Формируем URL с правильным кодированием
        const legacyUrl = encodeLegacyUrl(file.legacy_path)

        console.log(`[Migrate] Downloading: ${legacyUrl} (original: ${file.legacy_path})`)

        // Скачиваем файл с авторизацией (таймаут 30 секунд)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        let response: Response
        try {
          response = await fetch(legacyUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ZakazMigration/1.0)',
              'Authorization': getLegacyAuthHeader(),
            },
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timeoutId)
        }

        if (!response.ok) {
          results.push({
            id: file.id,
            filename: file.original_filename,
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
          })
          continue
        }

        // Получаем содержимое файла
        const buffer = Buffer.from(await response.arrayBuffer())

        // Создаём директорию если нужно
        await ensureUploadDirExists(file.application_id)

        // Сохраняем файл
        await fs.writeFile(filePath, buffer)

        // Обновляем размер файла в БД если он изменился
        const actualSize = buffer.length
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('zakaz_files') as any)
          .update({ file_size: actualSize })
          .eq('id', file.id)

        console.log(`[Migrate] Saved: ${file.original_filename} (${actualSize} bytes)`)

        results.push({
          id: file.id,
          filename: file.original_filename,
          success: true,
        })
      } catch (err) {
        console.error(`[Migrate] Error for ${file.original_filename}:`, err)
        results.push({
          id: file.id,
          filename: file.original_filename,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const successful = results.filter((r) => r.success && !r.skipped).length
    const skipped = results.filter((r) => r.skipped).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      message: `Migration completed: ${successful} downloaded, ${skipped} skipped (already exist), ${failed} failed`,
      results,
      summary: {
        total: results.length,
        downloaded: successful,
        skipped,
        failed,
      },
    })
  } catch (error) {
    console.error('Error migrating files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
