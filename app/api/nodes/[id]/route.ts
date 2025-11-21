import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'
import { validateSession } from '@/lib/session'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const session = await validateSession(request)

    // Только админы могут редактировать узлы
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can edit nodes' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Обновляем узел
    const table = supabase.from('zakaz_nodes') as unknown
    const result = await (table as {
      update: (data: unknown) => {
        eq: (column: string, value: unknown) => {
          select: () => {
            single: () => Promise<unknown>
          }
        }
      }
    })
      .update({
        code: body.code,
        node_type: body.node_type,
        address: body.address,
        location_details: body.location_details,
        comm_info: body.comm_info,
        status: body.status,
        contract_link: body.contract_link,
        node_created_date: body.node_created_date,
        updated_by: session.user.id,
      })
      .eq('id', id)
      .select()
      .single()

    const { data, error } = result as { data: unknown; error: { message: string } | null }

    if (error) {
      console.error('Error updating node:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Логируем обновление
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.full_name,
      actionType: 'update',
      entityType: 'other',
      entityId: id,
      description: `Updated node ${body.code}`,
      newValues: body,
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PUT /api/nodes/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
