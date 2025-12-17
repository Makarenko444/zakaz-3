import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface StreetResult {
  street: string
}

interface AddressResult {
  id: string
  street: string | null
  house: string | null
  building?: string | null
  comment: string | null
}

/**
 * Нормализует название улицы для поиска
 * Удаляет типы улиц (проспект, улица, тракт и т.д.) для более гибкого поиска
 */
function normalizeStreetName(street: string): string {
  let result = street.trim()

  const prefixes = [
    'проспект ', 'улица ', 'переулок ', 'площадь ', 'бульвар ',
    'шоссе ', 'тракт ', 'аллея ', 'набережная ', 'микрорайон ', 'проезд ', 'тупик ',
    'пр-т. ', 'пр-т ', 'пр. ', 'ул. ', 'пер. ', 'пл. ', 'б-р. ', 'б-р ',
    'ш. ', 'наб. ', 'мкр. ', 'пр-д. ', 'пр-д ',
    'пр ', 'ул ',
  ]

  const suffixes = [
    ' проспект', ' улица', ' переулок', ' площадь', ' бульвар',
    ' шоссе', ' тракт', ' аллея', ' набережная', ' микрорайон', ' проезд', ' тупик',
    ' пр-т', ' пр.', ' ул.', ' пер.', ' пл.', ' б-р', ' ш.', ' наб.', ' мкр.',
  ]

  const lowerResult = result.toLowerCase()

  for (const prefix of prefixes) {
    if (lowerResult.startsWith(prefix)) {
      result = result.substring(prefix.length).trim()
      break
    }
  }

  const lowerResultAfterPrefix = result.toLowerCase()
  for (const suffix of suffixes) {
    if (lowerResultAfterPrefix.endsWith(suffix)) {
      result = result.substring(0, result.length - suffix.length).trim()
      break
    }
  }

  return result
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const mode = searchParams.get('mode') || 'streets' // 'streets' или 'addresses'

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    const supabase = createDirectClient()
    const trimmedQuery = query.trim()
    const normalizedQuery = normalizeStreetName(trimmedQuery)

    // Режим поиска полных адресов (для AddressLinkWizard)
    if (mode === 'addresses') {
      // Попробуем разделить запрос на улицу и номер дома
      const streetHousePattern = /^(.+?)[\s,]+(\d+[а-яА-Яa-zA-Z]*)/
      const match = trimmedQuery.match(streetHousePattern)

      let data: AddressResult[] = []
      let error = null

      if (match) {
        const streetPartNormalized = normalizeStreetName(match[1].trim())
        const housePart = match[2].trim()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (supabase.from('zakaz_addresses') as any)
          .select('id, street, house, building, comment')
          .ilike('street', `%${streetPartNormalized}%`)
          .ilike('house', `%${housePart}%`)
          .order('street', { ascending: true })
          .order('house', { ascending: true })
          .limit(20)

        data = result.data || []
        error = result.error
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (supabase.from('zakaz_addresses') as any)
          .select('id, street, house, building, comment')
          .ilike('street', `%${normalizedQuery}%`)
          .order('street', { ascending: true })
          .order('house', { ascending: true })
          .limit(20)

        data = result.data || []
        error = result.error
      }

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json(
          { error: 'Failed to search addresses', details: error.message },
          { status: 500 }
        )
      }

      const addresses = (data || [])
        .filter(addr => addr.street && addr.house)
        .map(addr => ({
          ...addr,
          full_address: `${addr.street}, ${addr.house}`,
          source: 'local' as const
        }))

      return NextResponse.json({
        addresses,
        stats: {
          local: addresses.length,
          total: addresses.length
        }
      })
    }

    // Режим по умолчанию: поиск уникальных улиц (для формы создания заявки)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('zakaz_addresses') as any)
      .select('street')
      .ilike('street', `%${normalizedQuery}%`)
      .not('street', 'is', null)
      .order('street', { ascending: true })
      .limit(100)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to search addresses', details: error.message },
        { status: 500 }
      )
    }

    // Получаем уникальные улицы
    const uniqueStreets = [...new Set((data as StreetResult[]).map(item => item.street))]
      .filter(Boolean)
      .slice(0, 15)

    const streets = uniqueStreets.map(street => ({
      id: `street_${street}`,
      street: street,
    }))

    console.log(`Street search for "${trimmedQuery}" -> ${streets.length} unique streets`)

    return NextResponse.json({
      streets,
      stats: {
        total: streets.length
      }
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
