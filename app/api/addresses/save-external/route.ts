import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

/**
 * POST /api/addresses/save-external
 *
 * Сохраняет внешний адрес (из Яндекс API) в локальную таблицу zakaz_nodes
 * Вызывается автоматически когда пользователь выбирает адрес из внешнего источника
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { city, street, house, building, comment } = body

    // Валидация
    if (!street || !house) {
      return NextResponse.json(
        { error: 'Street and house are required' },
        { status: 400 }
      )
    }

    // Город по умолчанию если не указан
    const nodeCity = city || 'Томск'

    const supabase = createDirectClient()

    // Проверяем, есть ли уже такой адрес/узел в БД
    const { data: existing, error: checkError } = await supabase
      .from('zakaz_nodes')
      .select('id')
      .eq('city', nodeCity)
      .eq('street', street)
      .eq('house', house)
      .maybeSingle<{ id: string }>() // Возвращает null если не найдено, вместо error

    if (checkError) {
      console.error('Error checking existing node:', checkError)
      return NextResponse.json(
        { error: 'Failed to check existing address' },
        { status: 500 }
      )
    }

    // Если адрес уже существует - возвращаем его ID
    if (existing) {
      return NextResponse.json({
        id: existing.id,
        street,
        house,
        comment,
        message: 'Address already exists in local database',
        isNew: false
      })
    }

    // Генерируем уникальный код для адреса
    const code = `ADDR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

    // Сохраняем новый адрес как узел с presence_type = 'not_present'
    const { data: newNode, error: insertError } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('zakaz_nodes') as any)
      .insert({
        code,
        city: nodeCity,
        street,
        house,
        building: building || null,
        comment: comment || null,
        presence_type: 'not_present',
        status: 'existing',
        // address будет автоматически сформирован триггером в БД
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting node:', insertError)
      return NextResponse.json(
        { error: 'Failed to save address', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ...newNode,
      message: 'Address saved to local database',
      isNew: true
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
