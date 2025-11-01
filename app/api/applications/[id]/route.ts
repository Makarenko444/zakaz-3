import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createDirectClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('zakaz_applications')
      .select('*, zakaz_addresses(street, house, entrance, comment)')
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
      'address_id',
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

    // Подготовка данных для обновления
    const updateData = {
      address_id: body.address_id,
      customer_type: body.customer_type,
      service_type: body.service_type,
      customer_fullname: body.customer_fullname,
      customer_phone: body.customer_phone,
      contact_person: body.contact_person || null,
      contact_phone: body.contact_phone || null,
      urgency: body.urgency,
      client_comment: body.client_comment || null,
      assigned_to: body.assigned_to || null,
    }

    const { data, error } = await supabase
      .from('zakaz_applications')
      .update(updateData)
      .eq('id', id)
      .select('*, zakaz_addresses(street, house, entrance)')
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
        { error: 'Failed to update application', details: error.message },
        { status: 500 }
      )
    }

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
