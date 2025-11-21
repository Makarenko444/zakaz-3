import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

/**
 * POST /api/addresses/save-external
 *
 * Сохраняет внешний адрес (из КЛАДР API) в локальную таблицу zakaz_addresses
 * Вызывается автоматически когда пользователь выбирает адрес из внешнего источника
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { street, house, comment } = body

    // Валидация
    if (!street || !house) {
      return NextResponse.json(
        { error: 'Street and house are required' },
        { status: 400 }
      )
    }

    const supabase = createDirectClient()

    // Проверяем, есть ли уже такой адрес в БД
    const { data: existing, error: checkError } = await supabase
      .from('zakaz_addresses')
      .select('id')
      .eq('street', street)
      .eq('house', house)
      .maybeSingle<{ id: string }>() // Возвращает null если не найдено, вместо error

    if (checkError) {
      console.error('Error checking existing address:', checkError)
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

    // Сохраняем новый адрес
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newAddress, error: insertError } = await (supabase
      .from('zakaz_addresses')
      .insert({
        street,
        house,
        comment: comment || null
      })
      .select()
      .single() as any)

    if (insertError) {
      console.error('Error inserting address:', insertError)
      return NextResponse.json(
        { error: 'Failed to save address', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ...newAddress,
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
