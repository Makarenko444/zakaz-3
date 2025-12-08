import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface FileRow {
  file_size: number
  mime_type: string
  uploaded_at: string
  migrated: boolean
}

export async function GET() {
  try {
    const supabase = createDirectClient()

    // Получаем все файлы для статистики
    const { data, error } = await supabase
      .from('zakaz_files')
      .select('file_size, mime_type, uploaded_at, migrated')

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
      let type = 'Другие'
      if (f.mime_type.startsWith('image/')) type = 'Изображения'
      else if (f.mime_type === 'application/pdf') type = 'PDF'
      else if (f.mime_type.includes('word') || f.mime_type.includes('document')) type = 'Документы'
      else if (f.mime_type.includes('excel') || f.mime_type.includes('spreadsheet')) type = 'Таблицы'
      else if (f.mime_type.includes('zip') || f.mime_type.includes('archive') || f.mime_type.includes('rar')) type = 'Архивы'

      if (!typeStats[type]) {
        typeStats[type] = { count: 0, size: 0 }
      }
      typeStats[type].count++
      typeStats[type].size += f.file_size || 0
    })

    // Статистика по миграции
    const migratedCount = files.filter(f => f.migrated).length
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
