import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { getUserBySessionToken, SESSION_COOKIE_OPTIONS } from '@/lib/session'

// POST /api/admin/cleanup-unmigrateable - Удалить файлы, которые не удалось мигрировать (404 на старом сервере)
export async function POST(request: NextRequest) {
  try {
    // Проверка аутентификации и прав админа
    const sessionToken = request.cookies.get(SESSION_COOKIE_OPTIONS.name)?.value
    const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const supabase = createDirectClient()

    // Файлы, которые не удалось мигрировать (404 на старом сервере)
    const filesToDelete = [
      'CCTV-3.JPG',
      'Image 18.jpg',
      '-кт Мира, 26.xlsx',
      '-соборная 2 гастрноном.xlsx'
    ]

    const results: { deleted: string[]; notFound: string[]; errors: string[] } = {
      deleted: [],
      notFound: [],
      errors: []
    }

    for (const filename of filesToDelete) {
      const { data, error } = await supabase
        .from('zakaz_files')
        .delete()
        .eq('original_filename', filename)
        .not('legacy_path', 'is', null)
        .select('id, original_filename')

      if (error) {
        results.errors.push(`${filename}: ${error.message}`)
      } else if (data && data.length > 0) {
        results.deleted.push(filename)
      } else {
        results.notFound.push(filename)
      }
    }

    return NextResponse.json({
      message: `Удалено ${results.deleted.length} файлов`,
      ...results
    })
  } catch (error) {
    console.error('Error in cleanup:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
