import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { getFilePath } from '@/lib/file-upload'
import { promises as fs } from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')

// Категоризация MIME типов для статистики
function getCategoryFromMimeType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'spreadsheet'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('archive')) return 'archive'
  if (mimeType.startsWith('text/')) return 'text'
  return 'other'
}

// Человекочитаемые названия категорий
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    image: 'Изображения',
    video: 'Видео',
    audio: 'Аудио',
    pdf: 'PDF документы',
    document: 'Документы Word',
    spreadsheet: 'Таблицы Excel',
    archive: 'Архивы',
    text: 'Текстовые файлы',
    other: 'Другие',
    unknown: 'Неизвестные',
  }
  return labels[category] || category
}

// Получить паттерны MIME-типов для фильтрации по категории
function getMimePatternsForCategory(category: string): string[] {
  switch (category) {
    case 'image': return ['image/%']
    case 'video': return ['video/%']
    case 'audio': return ['audio/%']
    case 'pdf': return ['application/pdf']
    case 'document': return ['%word%', '%document%']
    case 'spreadsheet': return ['%excel%', '%spreadsheet%']
    case 'archive': return ['%zip%', '%rar%', '%7z%', '%archive%']
    case 'text': return ['text/%']
    case 'other': return [] // Для "other" нужна специальная обработка
    case 'unknown': return [] // Для unknown тоже
    default: return []
  }
}

// Получить информацию о диске
function getDiskInfo(): { total: number; used: number; free: number; percent: number } | null {
  try {
    // Используем df для получения информации о диске
    const output = execSync(`df -B1 "${UPLOAD_BASE_DIR}" 2>/dev/null || df -B1 / 2>/dev/null`).toString()
    const lines = output.trim().split('\n')
    if (lines.length < 2) return null

    const parts = lines[1].split(/\s+/)
    if (parts.length < 4) return null

    const total = parseInt(parts[1]) || 0
    const used = parseInt(parts[2]) || 0
    const free = parseInt(parts[3]) || 0
    const percent = total > 0 ? Math.round((used / total) * 100) : 0

    return { total, used, free, percent }
  } catch {
    return null
  }
}

interface FileRecord {
  id: string
  application_id: string
  original_filename: string
  stored_filename: string
  file_size: number
  mime_type: string
  uploaded_at: string
  legacy_path: string | null
  application?: {
    application_number: number
    customer_fullname: string
  } | null
}

// GET /api/admin/files - Получить список файлов и статистику
export async function GET(request: NextRequest) {
  try {
    // Проверка аутентификации и прав админа
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'list' // list, zombies, orphans
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const fileType = searchParams.get('fileType') || '' // Фильтр по категории типа файла

    const supabase = createDirectClient()

    if (mode === 'zombies') {
      // Файлы в БД без физического файла на диске
      const { data: allFiles, error } = await supabase
        .from('zakaz_files')
        .select(`
          id,
          application_id,
          original_filename,
          stored_filename,
          file_size,
          mime_type,
          uploaded_at,
          legacy_path,
          application:zakaz_applications!application_id(application_number, customer_fullname)
        `)
        .order('uploaded_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch files', details: error.message }, { status: 500 })
      }

      const files = (allFiles || []) as FileRecord[]

      // Проверяем каждый файл на существование
      const zombieFiles: (FileRecord & { reason: string })[] = []

      for (const file of files) {
        const filePath = getFilePath(file.application_id, file.stored_filename)
        let exists = false
        try {
          await fs.access(filePath)
          exists = true
        } catch {
          exists = false
        }

        if (!exists && !file.legacy_path) {
          // Файл должен быть локально, но его нет
          zombieFiles.push({ ...file, reason: 'Файл отсутствует на диске' })
        }
      }

      return NextResponse.json({
        mode: 'zombies',
        total: zombieFiles.length,
        files: zombieFiles,
      })
    }

    if (mode === 'orphans') {
      // Файлы на диске без записи в БД
      const orphanFiles: { path: string; applicationId: string; filename: string; size: number }[] = []

      try {
        // Получаем список всех директорий заявок
        const uploadDirs = await fs.readdir(UPLOAD_BASE_DIR)

        for (const appDir of uploadDirs) {
          const appPath = path.join(UPLOAD_BASE_DIR, appDir)
          const stat = await fs.stat(appPath)

          if (!stat.isDirectory()) continue

          // Получаем файлы в директории
          const filesInDir = await fs.readdir(appPath)

          for (const filename of filesInDir) {
            const filePath = path.join(appPath, filename)
            const fileStat = await fs.stat(filePath)

            if (!fileStat.isFile()) continue

            // Проверяем, есть ли запись в БД
            const { data: dbFile } = await supabase
              .from('zakaz_files')
              .select('id')
              .eq('application_id', appDir)
              .eq('stored_filename', filename)
              .single()

            if (!dbFile) {
              orphanFiles.push({
                path: filePath,
                applicationId: appDir,
                filename,
                size: fileStat.size,
              })
            }
          }
        }
      } catch (err) {
        console.error('Error scanning upload directory:', err)
      }

      return NextResponse.json({
        mode: 'orphans',
        total: orphanFiles.length,
        files: orphanFiles,
      })
    }

    if (mode === 'no-application') {
      // Файлы с несуществующей заявкой
      const { data: allFiles, error } = await supabase
        .from('zakaz_files')
        .select(`
          id,
          application_id,
          original_filename,
          stored_filename,
          file_size,
          mime_type,
          uploaded_at,
          legacy_path
        `)
        .order('uploaded_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch files', details: error.message }, { status: 500 })
      }

      const files = (allFiles || []) as FileRecord[]
      const orphanDbFiles: (FileRecord & { reason: string })[] = []

      for (const file of files) {
        const { data: app } = await supabase
          .from('zakaz_applications')
          .select('id')
          .eq('id', file.application_id)
          .single()

        if (!app) {
          orphanDbFiles.push({ ...file, reason: 'Заявка не существует' })
        }
      }

      return NextResponse.json({
        mode: 'no-application',
        total: orphanDbFiles.length,
        files: orphanDbFiles,
      })
    }

    if (mode === 'stats') {
      // Статистика по типам файлов
      const { data: allFiles, error } = await supabase
        .from('zakaz_files')
        .select('mime_type, file_size')

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch files', details: error.message }, { status: 500 })
      }

      const files = (allFiles || []) as { mime_type: string | null; file_size: number }[]

      // Группируем по типу файла
      const statsByType: Record<string, { count: number; totalSize: number }> = {}
      let totalCount = 0
      let totalSize = 0

      for (const file of files) {
        const mimeType = file.mime_type || 'unknown'
        // Упрощаем mime type для группировки (image/jpeg -> image)
        const category = getCategoryFromMimeType(mimeType)

        if (!statsByType[category]) {
          statsByType[category] = { count: 0, totalSize: 0 }
        }
        statsByType[category].count++
        statsByType[category].totalSize += file.file_size || 0
        totalCount++
        totalSize += file.file_size || 0
      }

      // Преобразуем в массив и сортируем по размеру
      const statsArray = Object.entries(statsByType)
        .map(([type, stats]) => ({
          type,
          label: getCategoryLabel(type),
          count: stats.count,
          totalSize: stats.totalSize,
          percentByCount: totalCount > 0 ? Math.round((stats.count / totalCount) * 100) : 0,
          percentBySize: totalSize > 0 ? Math.round((stats.totalSize / totalSize) * 100) : 0,
        }))
        .sort((a, b) => b.totalSize - a.totalSize)

      return NextResponse.json({
        mode: 'stats',
        totalCount,
        totalSize,
        byType: statsArray,
        diskInfo: getDiskInfo(),
      })
    }

    // Обычный список файлов с пагинацией
    let query = supabase
      .from('zakaz_files')
      .select(`
        id,
        application_id,
        original_filename,
        stored_filename,
        file_size,
        mime_type,
        uploaded_at,
        legacy_path,
        application:zakaz_applications!application_id(application_number, customer_fullname)
      `, { count: 'exact' })

    if (search) {
      query = query.ilike('original_filename', `%${search}%`)
    }

    // Фильтрация по типу файла
    if (fileType) {
      const mimePatterns = getMimePatternsForCategory(fileType)
      if (mimePatterns.length > 0) {
        // Используем or для фильтрации по нескольким шаблонам mime_type
        const orConditions = mimePatterns.map(p => `mime_type.ilike.${p}`).join(',')
        query = query.or(orConditions)
      }
    }

    query = query
      .order('uploaded_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    const { data: files, error, count } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch files', details: error.message }, { status: 500 })
    }

    // Проверяем статус миграции для каждого файла
    const filesWithStatus = await Promise.all(
      (files || []).map(async (file) => {
        const f = file as FileRecord
        const filePath = getFilePath(f.application_id, f.stored_filename)
        let existsLocally = false
        try {
          await fs.access(filePath)
          existsLocally = true
        } catch {
          existsLocally = false
        }

        return {
          ...f,
          existsLocally,
          needsMigration: !existsLocally && !!f.legacy_path,
        }
      })
    )

    return NextResponse.json({
      mode: 'list',
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      files: filesWithStatus,
      diskInfo: getDiskInfo(),
    })
  } catch (error) {
    console.error('Error in files API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/files - Удалить зомби/orphan файлы
export async function DELETE(request: NextRequest) {
  try {
    // Проверка аутентификации и прав админа
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { fileIds, orphanPaths } = body as { fileIds?: string[]; orphanPaths?: string[] }

    const supabase = createDirectClient()
    const results: { deleted: number; errors: string[] } = { deleted: 0, errors: [] }

    // Удаление записей из БД (для zombie файлов)
    if (fileIds && fileIds.length > 0) {
      for (const fileId of fileIds) {
        const { error } = await supabase
          .from('zakaz_files')
          .delete()
          .eq('id', fileId)

        if (error) {
          results.errors.push(`Failed to delete ${fileId}: ${error.message}`)
        } else {
          results.deleted++
        }
      }
    }

    // Удаление файлов с диска (для orphan файлов)
    if (orphanPaths && orphanPaths.length > 0) {
      for (const filePath of orphanPaths) {
        // Проверяем, что путь находится в директории uploads (безопасность)
        if (!filePath.startsWith(UPLOAD_BASE_DIR)) {
          results.errors.push(`Invalid path: ${filePath}`)
          continue
        }

        try {
          await fs.unlink(filePath)
          results.deleted++
        } catch (err) {
          results.errors.push(`Failed to delete ${filePath}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
    }

    return NextResponse.json({
      message: `Deleted ${results.deleted} items`,
      ...results,
    })
  } catch (error) {
    console.error('Error deleting files:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
