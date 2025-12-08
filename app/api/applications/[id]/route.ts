import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent, getUserData } from '@/lib/audit-log'
import { validateSession } from '@/lib/session'
import { deleteFile } from '@/lib/file-upload'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id } = await params

    const { data, error} = await supabase
      .from('zakaz_applications')
      .select(`
        *,
        zakaz_addresses!address_id(
          id,
          city,
          street,
          house,
          building,
          address,
          comment
        ),
        assigned_user:zakaz_users!zakaz_applications_assigned_to_fkey(id, full_name, email, role),
        created_by_user:zakaz_users!zakaz_applications_created_by_fkey(id, full_name, email, role),
        updated_by_user:zakaz_users!zakaz_applications_updated_by_fkey(id, full_name, email, role)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Application not found' },
          { status: 404 }
        )
      }
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch application', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ application: data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id } = await params
    const body = await request.json()

    // Валидация обязательных полей
    const requiredFields = [
      'customer_type',
      'service_type',
      'customer_fullname',
      'customer_phone',
      'urgency'
    ]

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Field '${field}' is required` },
          { status: 400 }
        )
      }
    }

    // Для юр.лиц обязательны контактные данные
    if (body.customer_type === 'business') {
      if (!body.contact_person || !body.contact_phone) {
        return NextResponse.json(
          { error: 'Contact person and phone are required for business customers' },
          { status: 400 }
        )
      }
    }

    // Валидация статуса привязки адреса
    if (body.address_match_status) {
      const validStatuses = ['unmatched', 'auto_matched', 'manual_matched']
      if (!validStatuses.includes(body.address_match_status)) {
        return NextResponse.json(
          { error: 'Invalid address_match_status' },
          { status: 400 }
        )
      }
    }

    // Получаем старые значения для логирования
    const { data: oldData } = await supabase
      .from('zakaz_applications')
      .select('customer_fullname, customer_phone, urgency, service_type')
      .eq('id', id)
      .single()

    // Подготовка данных для обновления
    const updateData: Record<string, unknown> = {
      street_and_house: body.street_and_house || null,
      address_details: body.address_details || null,
      customer_type: body.customer_type,
      service_type: body.service_type,
      customer_fullname: body.customer_fullname,
      customer_phone: body.customer_phone,
      contact_person: body.contact_person || null,
      contact_phone: body.contact_phone || null,
      urgency: body.urgency,
      client_comment: body.client_comment || null,
      assigned_to: body.assigned_to || null,
      updated_by: body.updated_by || null,
    }

    // Обновляем статус привязки адреса если передан
    if (body.address_match_status) {
      updateData.address_match_status = body.address_match_status
    }

    // Обновляем address_id только если он явно передан в запросе
    if ('address_id' in body) {
      updateData.address_id = body.address_id || null
    }

    // Обходим проблемы с автогенерируемыми типами Supabase через unknown
    const table = supabase.from('zakaz_applications') as unknown
    const builder = (table as { update: (data: Record<string, unknown>) => unknown }).update(updateData) as unknown
    const filtered = (builder as { eq: (col: string, val: string) => unknown }).eq('id', id) as unknown
    const selector = (filtered as { select: (cols: string) => unknown }).select(`
      *,
      zakaz_addresses!address_id(
        id,
        city,
        street,
        house,
        building,
        address,
        comment
      ),
      assigned_user:zakaz_users!zakaz_applications_assigned_to_fkey(id, full_name, email, role),
      created_by_user:zakaz_users!zakaz_applications_created_by_fkey(id, full_name, email, role),
      updated_by_user:zakaz_users!zakaz_applications_updated_by_fkey(id, full_name, email, role)
    `) as unknown
    const query = (selector as { single: () => Promise<unknown> }).single()
    const result = await query
    const { data, error } = result as { data: unknown; error: unknown }

    if (error) {
      const dbError = error as { code?: string; message?: string }
      if (dbError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Application not found' },
          { status: 404 }
        )
      }
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update application', details: dbError.message },
        { status: 500 }
      )
    }

    // Логируем редактирование
    // Получаем данные пользователя для аудита
    const userData = await getUserData(body.updated_by)

    await logAudit({
      ...userData,
      actionType: 'update',
      entityType: 'application',
      entityId: id,
      description: 'Заявка отредактирована.',
      oldValues: oldData || undefined,
      newValues: {
        customer_fullname: body.customer_fullname,
        customer_phone: body.customer_phone,
        urgency: body.urgency,
        service_type: body.service_type,
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json(
      { application: data, message: 'Application updated successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Проверяем авторизацию и права администратора
    const session = await validateSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Только администратор может удалять заявки' },
        { status: 403 }
      )
    }

    const supabase = createDirectClient()
    const { id } = await params

    // Получаем данные заявки перед удалением (для лога)
    const { data: application, error: fetchError } = await supabase
      .from('zakaz_applications')
      .select('application_number, customer_fullname, street_and_house')
      .eq('id', id)
      .single() as { data: { application_number: number; customer_fullname: string; street_and_house: string | null } | null; error: { code?: string; message?: string } | null }

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Заявка не найдена' },
          { status: 404 }
        )
      }
      console.error('Database error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch application', details: fetchError.message },
        { status: 500 }
      )
    }

    // Удаляем связанные данные в правильном порядке

    // 1. Удаляем комментарии
    const { error: commentsError } = await supabase
      .from('zakaz_application_comments')
      .delete()
      .eq('application_id', id)

    if (commentsError) {
      console.error('Error deleting comments:', commentsError)
    }

    // 2. Удаляем файлы (сначала с диска, потом из БД)
    const { data: files } = await supabase
      .from('zakaz_files')
      .select('stored_filename')
      .eq('application_id', id)

    if (files && files.length > 0) {
      // Удаляем физические файлы с диска
      for (const file of files) {
        try {
          await deleteFile(id, file.stored_filename)
        } catch (err) {
          console.error(`Error deleting file ${file.stored_filename}:`, err)
        }
      }
    }

    // Удаляем записи о файлах из БД
    const { error: filesError } = await supabase
      .from('zakaz_files')
      .delete()
      .eq('application_id', id)

    if (filesError) {
      console.error('Error deleting file records:', filesError)
    }

    // 3. Удаляем логи
    const { error: logsError } = await supabase
      .from('zakaz_application_logs')
      .delete()
      .eq('application_id', id)

    if (logsError) {
      console.error('Error deleting logs:', logsError)
    }

    // 4. Удаляем саму заявку
    const { error: deleteError } = await supabase
      .from('zakaz_applications')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting application:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete application', details: deleteError.message },
        { status: 500 }
      )
    }

    // Логируем удаление
    const userData = await getUserData(session.user.id)

    await logAudit({
      ...userData,
      actionType: 'delete',
      entityType: 'application',
      entityId: id,
      description: `Удалена заявка №${application?.application_number}: ${application?.customer_fullname} (${application?.street_and_house || 'адрес не указан'})`,
      oldValues: application || undefined,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json(
      { message: 'Заявка успешно удалена' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
