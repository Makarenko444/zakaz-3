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
      // Сначала получаем список заявок для удаления
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

        // Удаляем заявки
        await supabase
          .from('zakaz_applications')
          .delete()
          .in('id', appIds)

        results.applications = legacyApps.length
      } else {
        results.applications = 0
      }
    }

    // Удаление комментариев (с legacy_id)
    if (type === 'comments' || type === 'all') {
      // Сначала считаем
      const { data: legacyComments } = await supabase
        .from('zakaz_application_comments')
        .select('id')
        .not('legacy_id', 'is', null)

      if (legacyComments && legacyComments.length > 0) {
        await supabase
          .from('zakaz_application_comments')
          .delete()
          .not('legacy_id', 'is', null)

        results.comments = legacyComments.length
      } else {
        results.comments = 0
      }
    }

    // Удаление файлов (с legacy_id)
    if (type === 'files' || type === 'all') {
      const { data: legacyFiles } = await supabase
        .from('zakaz_application_files')
        .select('id')
        .not('legacy_id', 'is', null)

      if (legacyFiles && legacyFiles.length > 0) {
        await supabase
          .from('zakaz_application_files')
          .delete()
          .not('legacy_id', 'is', null)

        results.files = legacyFiles.length
      } else {
        results.files = 0
      }
    }

    // Удаление пользователей (с legacy_uid, кроме текущего админа)
    if (type === 'users' || type === 'all') {
      const { data: legacyUsers } = await supabase
        .from('zakaz_users')
        .select('id')
        .not('legacy_uid', 'is', null)
        .neq('id', session.user.id)

      if (legacyUsers && legacyUsers.length > 0) {
        await supabase
          .from('zakaz_users')
          .delete()
          .not('legacy_uid', 'is', null)
          .neq('id', session.user.id)

        results.users = legacyUsers.length
      } else {
        results.users = 0
      }
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
        .select('id')
        .not('legacy_id', 'is', null),
      supabase
        .from('zakaz_application_comments')
        .select('id')
        .not('legacy_id', 'is', null),
      supabase
        .from('zakaz_application_files')
        .select('id')
        .not('legacy_id', 'is', null),
      supabase
        .from('zakaz_users')
        .select('id')
        .not('legacy_uid', 'is', null),
    ])

    return NextResponse.json({
      counts: {
        applications: (applications.data as unknown[] | null)?.length || 0,
        comments: (comments.data as unknown[] | null)?.length || 0,
        files: (files.data as unknown[] | null)?.length || 0,
        users: (users.data as unknown[] | null)?.length || 0,
      },
    })
  } catch (error) {
    console.error('Error getting legacy counts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
