import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { requireAdmin } from '@/lib/auth-api'

interface AddressRow {
  id: string
  street: string | null
  address: string | null
}

/**
 * POST /api/admin/addresses/replace-text
 * Массовая замена текста в адресах
 * Body: { search: string, replace: string, field: 'street' | 'address', dryRun?: boolean }
 */
export async function POST(request: Request) {
  // Проверка прав администратора
  const authResult = await requireAdmin()
  if (authResult instanceof NextResponse) {
    return authResult
  }

  try {
    const body = await request.json()
    const { search, replace, field = 'street', dryRun = false } = body

    if (!search || replace === undefined) {
      return NextResponse.json(
        { error: 'Параметры search и replace обязательны' },
        { status: 400 }
      )
    }

    if (!['street', 'address'].includes(field)) {
      return NextResponse.json(
        { error: 'Поле field должно быть street или address' },
        { status: 400 }
      )
    }

    const supabase = createDirectClient()

    // Сначала находим все записи для замены
    const { data, error: selectError } = await supabase
      .from('zakaz_addresses')
      .select('id, street, address')
      .ilike(field, `%${search}%`) as { data: AddressRow[] | null; error: { message: string } | null }

    if (selectError) {
      console.error('Select error:', selectError)
      return NextResponse.json(
        { error: 'Ошибка поиска записей', details: selectError.message },
        { status: 500 }
      )
    }

    const toUpdate = data || []
    const count = toUpdate.length

    if (dryRun) {
      // Режим предпросмотра - только показываем что будет изменено
      const preview = toUpdate.slice(0, 20).map(row => {
        const fieldValue = field === 'street' ? row.street : row.address
        return {
          id: row.id,
          before: fieldValue,
          after: fieldValue?.replace(new RegExp(search, 'gi'), replace)
        }
      })

      return NextResponse.json({
        dryRun: true,
        count,
        preview,
        message: `Найдено ${count} записей для замены "${search}" на "${replace}" в поле ${field}`
      })
    }

    // Выполняем замену для каждой записи
    let updated = 0
    const errors: string[] = []

    for (const row of toUpdate) {
      const newStreet = row.street?.replace(new RegExp(search, 'gi'), replace)
      const newAddress = row.address?.replace(new RegExp(search, 'gi'), replace)

      const updateData: Record<string, string> = {}
      if (field === 'street' && newStreet !== row.street) {
        updateData.street = newStreet || ''
        // Также обновляем полный адрес
        updateData.address = newAddress || ''
      } else if (field === 'address' && newAddress !== row.address) {
        updateData.address = newAddress || ''
      }

      if (Object.keys(updateData).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from as any)('zakaz_addresses')
          .update(updateData)
          .eq('id', row.id)

        if (updateError) {
          errors.push(`ID ${row.id}: ${updateError.message}`)
        } else {
          updated++
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      total: count,
      errors: errors.length > 0 ? errors : undefined,
      message: `Обновлено ${updated} из ${count} записей`
    })

  } catch (error) {
    console.error('Replace text error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
