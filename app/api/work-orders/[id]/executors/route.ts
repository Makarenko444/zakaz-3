import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent, getUserData } from '@/lib/audit-log'

// Таблицы zakaz_work_orders и zakaz_work_order_executors еще не в сгенерированных типах Supabase

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/work-orders/[id]/executors - список исполнителей наряда
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()

    // Проверяем существование наряда
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workOrder, error: woError } = await (supabase.from as any)('zakaz_work_orders')
      .select('id')
      .eq('id', id)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('zakaz_work_order_executors')
      .select(`
        id,
        user_id,
        is_lead,
        created_at,
        user:zakaz_users(id, full_name, email, phone, role)
      `)
      .eq('work_order_id', id)
      .order('is_lead', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch executors', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ executors: data || [] })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/work-orders/[id]/executors - добавление исполнителя
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const body = await request.json()

    const { user_id, is_lead, added_by } = body

    if (!user_id) {
      return NextResponse.json(
        { error: 'Field "user_id" is required' },
        { status: 400 }
      )
    }

    // Проверяем существование наряда
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workOrder, error: woError } = await (supabase.from as any)('zakaz_work_orders')
      .select('id, work_order_number')
      .eq('id', id)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // Проверяем существование пользователя
    const userResult = await supabase
      .from('zakaz_users')
      .select('id, full_name')
      .eq('id', user_id)
      .single()
    const user = userResult.data as { id: string; full_name: string } | null
    const userError = userResult.error

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Проверяем что исполнитель ещё не добавлен
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from as any)('zakaz_work_order_executors')
      .select('id')
      .eq('work_order_id', id)
      .eq('user_id', user_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Executor already assigned to this work order' },
        { status: 400 }
      )
    }

    // Если is_lead = true, снимаем флаг с текущего бригадира
    if (is_lead) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from as any)('zakaz_work_order_executors')
        .update({ is_lead: false })
        .eq('work_order_id', id)
        .eq('is_lead', true)
    }

    // Добавляем исполнителя
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('zakaz_work_order_executors')
      .insert({
        work_order_id: id,
        user_id,
        is_lead: is_lead || false,
      })
      .select(`
        id,
        user_id,
        is_lead,
        created_at,
        user:zakaz_users(id, full_name, email, phone, role)
      `)
      .single()

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to add executor', details: error.message },
        { status: 500 }
      )
    }

    // Логируем добавление
    const userData = await getUserData(added_by)
    const leadLabel = is_lead ? ' (бригадир)' : ''

    await logAudit({
      ...userData,
      actionType: 'assign',
      entityType: 'work_order',
      entityId: id,
      description: `Наряд №${workOrder.work_order_number}: добавлен исполнитель ${user.full_name}${leadLabel}`,
      newValues: { executor: user.full_name, is_lead },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json(
      { executor: data, message: 'Executor added successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/work-orders/[id]/executors?executor_id=xxx - удаление исполнителя
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams
    const executorId = searchParams.get('executor_id')
    const userId = searchParams.get('user_id') // кто удаляет

    if (!executorId) {
      return NextResponse.json(
        { error: 'Query parameter "executor_id" is required' },
        { status: 400 }
      )
    }

    // Получаем данные исполнителя перед удалением
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: executor, error: fetchError } = await (supabase.from as any)('zakaz_work_order_executors')
      .select(`
        id,
        user_id,
        is_lead,
        work_order:zakaz_work_orders(work_order_number),
        user:zakaz_users(full_name)
      `)
      .eq('id', executorId)
      .eq('work_order_id', id)
      .single()

    if (fetchError || !executor) {
      return NextResponse.json(
        { error: 'Executor not found' },
        { status: 404 }
      )
    }

    // Удаляем исполнителя
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)('zakaz_work_order_executors')
      .delete()
      .eq('id', executorId)

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to remove executor', details: error.message },
        { status: 500 }
      )
    }

    // Логируем удаление
    const userData = await getUserData(userId)
    const workOrderData = executor.work_order as { work_order_number: number } | null
    const userFullName = (executor.user as { full_name: string } | null)?.full_name || 'Unknown'

    await logAudit({
      ...userData,
      actionType: 'unassign',
      entityType: 'work_order',
      entityId: id,
      description: `Наряд №${workOrderData?.work_order_number}: удалён исполнитель ${userFullName}`,
      oldValues: { executor: userFullName, is_lead: executor.is_lead },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      message: 'Executor removed successfully',
    })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/work-orders/[id]/executors - обновление is_lead
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createDirectClient()
    const body = await request.json()

    const { executor_id, is_lead, updated_by } = body

    if (!executor_id) {
      return NextResponse.json(
        { error: 'Field "executor_id" is required' },
        { status: 400 }
      )
    }

    // Проверяем существование исполнителя
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: executor, error: fetchError } = await (supabase.from as any)('zakaz_work_order_executors')
      .select(`
        id,
        user_id,
        work_order:zakaz_work_orders(work_order_number),
        user:zakaz_users(full_name)
      `)
      .eq('id', executor_id)
      .eq('work_order_id', id)
      .single()

    if (fetchError || !executor) {
      return NextResponse.json(
        { error: 'Executor not found' },
        { status: 404 }
      )
    }

    // Если делаем бригадиром, снимаем флаг с текущего
    if (is_lead) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from as any)('zakaz_work_order_executors')
        .update({ is_lead: false })
        .eq('work_order_id', id)
        .eq('is_lead', true)
    }

    // Обновляем
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('zakaz_work_order_executors')
      .update({ is_lead: is_lead || false })
      .eq('id', executor_id)
      .select(`
        id,
        user_id,
        is_lead,
        created_at,
        user:zakaz_users(id, full_name, email, phone, role)
      `)
      .single()

    if (error) {
      console.error('[WorkOrders API] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update executor', details: error.message },
        { status: 500 }
      )
    }

    // Логируем изменение
    const userData = await getUserData(updated_by)
    const workOrderData = executor.work_order as { work_order_number: number } | null
    const userFullName = (executor.user as { full_name: string } | null)?.full_name || 'Unknown'

    await logAudit({
      ...userData,
      actionType: 'update',
      entityType: 'work_order',
      entityId: id,
      description: `Наряд №${workOrderData?.work_order_number}: ${userFullName} ${is_lead ? 'назначен бригадиром' : 'снят с бригадира'}`,
      newValues: { executor: userFullName, is_lead },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      executor: data,
      message: 'Executor updated successfully',
    })
  } catch (error) {
    console.error('[WorkOrders API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
