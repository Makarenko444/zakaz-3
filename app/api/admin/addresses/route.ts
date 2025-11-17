import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'

// GET - получить все адреса с количеством привязанных заявок
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 401 })
    }

    const supabase = createDirectClient()

    // Получаем все адреса
    const addressesQuery = await supabase
      .from('zakaz_addresses')
      .select('*')
      .order('street', { ascending: true })
      .order('house', { ascending: true })

    const addresses = addressesQuery.data as Array<{
      id: string
      street: string
      house: string
      comment: string | null
      created_at?: string
      updated_at?: string
    }> | null
    const addressesError = addressesQuery.error

    if (addressesError) {
      console.error('Error fetching addresses:', addressesError)
      return NextResponse.json({ error: 'Не удалось загрузить адреса' }, { status: 500 })
    }

    // Получаем все заявки с address_id для подсчета
    const applicationsQuery = await supabase
      .from('zakaz_applications')
      .select('address_id')
      .not('address_id', 'is', null)

    const applications = applicationsQuery.data as { address_id: string }[] | null
    const appsError = applicationsQuery.error

    if (appsError) {
      console.error('Error fetching applications:', appsError)
      return NextResponse.json({ error: 'Не удалось загрузить счетчики' }, { status: 500 })
    }

    // Подсчитываем количество заявок для каждого адреса
    const countMap = new Map<string, number>()
    if (applications) {
      for (const app of applications) {
        const count = countMap.get(app.address_id) || 0
        countMap.set(app.address_id, count + 1)
      }
    }

    // Добавляем счетчики к адресам
    const addressesWithCounts = (addresses || []).map(addr => ({
      ...addr,
      applications_count: countMap.get(addr.id) || 0
    }))

    return NextResponse.json({ addresses: addressesWithCounts })
  } catch (error) {
    console.error('Error in admin addresses GET:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// POST - создать новый адрес
export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 401 })
    }

    const body = await request.json()
    const { street, house, comment } = body

    if (!street || !house) {
      return NextResponse.json(
        { error: 'Отсутствуют обязательные поля' },
        { status: 400 }
      )
    }

    const supabase = createDirectClient()

    const table = supabase.from('zakaz_addresses') as unknown
    const insertBuilder = (table as { insert: (data: Record<string, unknown>) => unknown }).insert({
      street,
      house,
      comment: comment || null,
    }) as unknown
    const selectBuilder = (insertBuilder as { select: () => unknown }).select() as unknown
    const result = await (selectBuilder as { single: () => Promise<unknown> }).single()
    const { data, error } = result as { data: unknown; error: unknown }

    if (error) {
      console.error('Error creating address:', error)
      return NextResponse.json({ error: 'Не удалось создать адрес' }, { status: 500 })
    }

    return NextResponse.json({ address: data })
  } catch (error) {
    console.error('Error in admin addresses POST:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
