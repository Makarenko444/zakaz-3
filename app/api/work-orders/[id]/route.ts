import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent, getUserData } from '@/lib/audit-log'

// Таблицы zakaz_work_orders и связанные еще не в сгенерированных типах Supabase

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/work-orders/[id] - получение наряда по ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('zakaz_work_orders')
      .select(`
        *,
        application:zakaz_applications(
          id,
          application_number,
          customer_fullname,
          customer_phone,
          customer_type,
          city,
          street_and_house,
          address_details,
          service_type,
          urgency,
          status,
          contact_person,
          contact_phone
        ),
        executors:zakaz_work_order_executors(
          id,
          user_id,
          is_lead,
          created_at,
          user:zakaz_users(id, full_name, email, phone, role)
        ),
        materials:zakaz_work_order_materials(
          id,
          material_id,
          material_name,
          unit,
          quantity,
          notes,
          created_at
        ),
        created_by_user:zakaz_users!created_by(id, full_name, email),
        updated_by_user:zakaz_users!updated_by(id, full_name, email)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Work order not found' },
          { status: 404 }
        )
      }
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch work order', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ work_order: data })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/work-orders/[id] - обновление наряда
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const body = await request.json()

    // Получаем текущие данные для аудита
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentData, error: fetchError } = await (supabase.from as any)('zakaz_work_orders')
      .select('*, application:zakaz_applications(application_number)')
      .eq('id', id)
      .single()

    if (fetchError || !currentData) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // Разрешённые поля для обновления
    const allowedFields = [
      'scheduled_date',
      'scheduled_time',
      'estimated_duration',
      'actual_start_at',
      'actual_end_at',
      'notes',
      'result_notes',
      'customer_signature',
      'updated_by',
    ]

    const updateData: Record<string, unknown> = {}
    const oldValues: Record<string, unknown> = {}
    const newValues: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        oldValues[field] = currentData[field as keyof typeof currentData]
        newValues[field] = body[field]
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Добавляем updated_by если не передан
    if (!updateData.updated_by && body.user_id) {
      updateData.updated_by = body.user_id
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('zakaz_work_orders')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update work order', details: error.message },
        { status: 500 }
      )
    }

    // Логируем изменение
    const userData = await getUserData(body.user_id || body.updated_by)

    await logAudit({
      ...userData,
      actionType: 'update',
      entityType: 'work_order',
      entityId: id,
      description: `Обновлён наряд №${data.work_order_number}`,
      oldValues,
      newValues,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      work_order: data,
      message: 'Work order updated successfully',
    })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/work-orders/[id] - удаление наряда
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('user_id')

    // Получаем данные наряда перед удалением
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workOrder, error: fetchError } = await (supabase.from as any)('zakaz_work_orders')
      .select('*, application:zakaz_applications(application_number)')
      .eq('id', id)
      .single()

    if (fetchError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // Удаляем наряд (каскадно удалятся исполнители, материалы, история)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)('zakaz_work_orders')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete work order', details: error.message },
        { status: 500 }
      )
    }

    // Логируем удаление
    const userData = await getUserData(userId)
    const typeLabel = workOrder.type === 'survey' ? 'Осмотр и расчёт' : 'Монтаж'

    await logAudit({
      ...userData,
      actionType: 'delete',
      entityType: 'work_order',
      entityId: id,
      description: `Удалён наряд №${workOrder.work_order_number} (${typeLabel})`,
      oldValues: {
        type: workOrder.type,
        status: workOrder.status,
        scheduled_date: workOrder.scheduled_date,
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      message: 'Work order deleted successfully',
    })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
