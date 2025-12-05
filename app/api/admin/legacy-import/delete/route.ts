import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'

// DELETE - удалить импортированные данные
export async function DELETE(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type || !['applications', 'comments', 'files', 'users', 'all'].includes(type)) {
      return NextResponse.json(
        { error: 'Неверный тип данных для удаления' },
        { status: 400 }
      )
    }

    const supabase = createDirectClient()
    const results: Record<string, number> = {}

    // Удаление заявок (с legacy_id)
    if (type === 'applications' || type === 'all') {
      // Сначала удаляем связанные комментарии и файлы
      const { data: legacyApps } = await supabase
        .from('zakaz_applications')
        .select('id')
        .not('legacy_id', 'is', null)

      if (legacyApps && legacyApps.length > 0) {
        const appIds = legacyApps.map((a: { id: string }) => a.id)

        // Удаляем комментарии
        await supabase
          .from('zakaz_application_comments')
          .delete()
          .in('application_id', appIds)

        // Удаляем файлы
        await supabase
          .from('zakaz_application_files')
          .delete()
          .in('application_id', appIds)

        // Удаляем логи
        await supabase
          .from('zakaz_application_logs')
          .delete()
          .in('application_id', appIds)
      }

      const { count } = await supabase
        .from('zakaz_applications')
        .delete()
        .not('legacy_id', 'is', null)
        .select('*', { count: 'exact', head: true }) as { count: number | null }

      results.applications = count || 0
    }

    // Удаление комментариев (с legacy_id)
    if (type === 'comments' || type === 'all') {
      const { count } = await supabase
        .from('zakaz_application_comments')
        .delete()
        .not('legacy_id', 'is', null)
        .select('*', { count: 'exact', head: true }) as { count: number | null }

      results.comments = count || 0
    }

    // Удаление файлов (с legacy_id)
    if (type === 'files' || type === 'all') {
      const { count } = await supabase
        .from('zakaz_application_files')
        .delete()
        .not('legacy_id', 'is', null)
        .select('*', { count: 'exact', head: true }) as { count: number | null }

      results.files = count || 0
    }

    // Удаление пользователей (с legacy_uid, кроме текущего админа)
    if (type === 'users' || type === 'all') {
      const { count } = await supabase
        .from('zakaz_users')
        .delete()
        .not('legacy_uid', 'is', null)
        .neq('id', session.user.id) // Не удаляем текущего пользователя
        .select('*', { count: 'exact', head: true }) as { count: number | null }

      results.users = count || 0
    }

    return NextResponse.json({
      success: true,
      deleted: results,
    })
  } catch (error) {
    console.error('Error deleting legacy data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - получить количество импортированных данных
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createDirectClient()

    const [applications, comments, files, users] = await Promise.all([
      supabase
        .from('zakaz_applications')
        .select('*', { count: 'exact', head: true })
        .not('legacy_id', 'is', null),
      supabase
        .from('zakaz_application_comments')
        .select('*', { count: 'exact', head: true })
        .not('legacy_id', 'is', null),
      supabase
        .from('zakaz_application_files')
        .select('*', { count: 'exact', head: true })
        .not('legacy_id', 'is', null),
      supabase
        .from('zakaz_users')
        .select('*', { count: 'exact', head: true })
        .not('legacy_uid', 'is', null),
    ])

    return NextResponse.json({
      counts: {
        applications: (applications as { count: number | null }).count || 0,
        comments: (comments as { count: number | null }).count || 0,
        files: (files as { count: number | null }).count || 0,
        users: (users as { count: number | null }).count || 0,
      },
    })
  } catch (error) {
    console.error('Error getting legacy counts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
