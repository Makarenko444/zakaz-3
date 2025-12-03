import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const supabase = getSupabaseClient()

    // Получаем информацию о пользователе
    const { data: user, error: userError } = await supabase
      .from('zakaz_users')
      .select('id, full_name, email, role, phone')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    // Получаем заявки, где пользователь автор
    const { data: createdApplications, error: createdError } = await supabase
      .from('zakaz_applications')
      .select(`
        id,
        application_number,
        status,
        urgency,
        service_type,
        street_and_house,
        address_details,
        created_at,
        zakaz_nodes (
          id,
          code,
          presence_type
        ),
        zakaz_addresses (
          id,
          city,
          street,
          house,
          building,
          address
        )
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (createdError) {
      console.error('Error loading created applications:', createdError)
    }

    // Получаем заявки, где пользователь назначенный менеджер
    const { data: assignedApplications, error: assignedError } = await supabase
      .from('zakaz_applications')
      .select(`
        id,
        application_number,
        status,
        urgency,
        service_type,
        street_and_house,
        address_details,
        created_at,
        zakaz_nodes (
          id,
          code,
          presence_type
        ),
        zakaz_addresses (
          id,
          city,
          street,
          house,
          building,
          address
        )
      `)
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (assignedError) {
      console.error('Error loading assigned applications:', assignedError)
    }

    // Подсчитываем статистику
    const { count: createdCount } = await supabase
      .from('zakaz_applications')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', userId)

    const { count: assignedCount } = await supabase
      .from('zakaz_applications')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)

    // Подсчитываем комментарии пользователя
    const { count: commentsCount } = await supabase
      .from('zakaz_application_comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    return NextResponse.json({
      user,
      createdApplications: createdApplications || [],
      assignedApplications: assignedApplications || [],
      statistics: {
        createdCount: createdCount || 0,
        assignedCount: assignedCount || 0,
        commentsCount: commentsCount || 0,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/users/[id]/applications:', error)
    return NextResponse.json(
      { error: 'Ошибка при загрузке данных пользователя' },
      { status: 500 }
    )
  }
}
