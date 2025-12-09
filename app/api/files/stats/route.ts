import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface FileRow {
  file_size: number
  mime_type: string
  uploaded_at: string
  stored_filename: string | null
}

export async function GET() {
  try {
    const supabase = createDirectClient()

    // Получаем все файлы для статистики
    const { data, error } = await supabase
      .from('zakaz_files')
      .select('file_size, mime_type, uploaded_at, stored_filename')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch file stats', details: error.message },
        { status: 500 }
      )
    }

    const files = (data || []) as FileRow[]

    // Подсчёт статистики
    const totalFiles = files.length
    const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0)

    // Статистика по типам
    const typeStats: Record<string, { count: number; size: number }> = {}
    files.forEach((f) => {
      const mimeType = f.mime_type || ''
      let type = 'Другие'
      if (mimeType.startsWith('image/')) type = 'Изображения'
      else if (mimeType === 'application/pdf') type = 'PDF'
      else if (mimeType.includes('word') || mimeType.includes('document')) type = 'Документы'
      else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) type = 'Таблицы'
      else if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('rar')) type = 'Архивы'

      if (!typeStats[type]) {
        typeStats[type] = { count: 0, size: 0 }
      }
      typeStats[type].count++
      typeStats[type].size += f.file_size || 0
    })

    // Статистика по миграции (файлы с stored_filename = в хранилище)
    const migratedCount = files.filter(f => f.stored_filename).length
    const pendingMigration = totalFiles - migratedCount

    // Файлы за последние 7 дней
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const recentFiles = files.filter(f => new Date(f.uploaded_at) > weekAgo).length

    // Файлы за последние 30 дней
    const monthAgo = new Date()
    monthAgo.setDate(monthAgo.getDate() - 30)
    const monthFiles = files.filter(f => new Date(f.uploaded_at) > monthAgo).length

    return NextResponse.json({
      totalFiles,
      totalSize,
      typeStats,
      migratedCount,
      pendingMigration,
      recentFiles,
      monthFiles,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
