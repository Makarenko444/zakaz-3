import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'
import { getFilePath, getApplicationUploadDir } from '@/lib/file-upload'
import { promises as fs } from 'fs'
import path from 'path'

const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')

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

      const files = allFiles || []
      const orphanDbFiles: (typeof files[0] & { reason: string })[] = []

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
