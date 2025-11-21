import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface Address {
  id: string
  street: string
  house: string
  comment: string | null
  created_at?: string
  updated_at?: string
}

interface SearchResult extends Address {
  similarity: number
  full_address: string
  source: 'local' | 'external' // Источник: локальная БД или внешний API
}

interface RpcSearchResult {
  id: string
  street: string
  house: string
  comment: string | null
  similarity: number
  created_at?: string
  updated_at?: string
}

interface KladrBuilding {
  name: string // Номер дома
}

interface KladrStreet {
  id: string
  name: string // Название улицы
  typeShort: string // Тип (ул., пр., пер.)
}

async function searchKladrAPI(query: string): Promise<SearchResult[]> {
  /**
   * Поиск адресов через КЛАДР API
   * Используется когда в локальной БД мало результатов
   */
  const results: SearchResult[] = []

  try {
    // Ищем улицы в Томске по запросу
    const streetsResponse = await fetch(
      `http://kladr-api.ru/api.php?contentType=street&cityId=7000000100000&query=${encodeURIComponent(query)}&limit=5`,
      { next: { revalidate: 3600 } } // Кешируем на 1 час
    )

    if (!streetsResponse.ok) {
      console.error('KLADR API error:', streetsResponse.status)
      return results
    }

    const streetsData = await streetsResponse.json()
    const streets = streetsData.result as KladrStreet[] || []

    // Для каждой улицы получаем дома
    for (const street of streets.slice(0, 3)) { // Берем первые 3 улицы
      const streetId = street.id
      const streetName = `${street.typeShort} ${street.name}`.trim()

      const buildingsResponse = await fetch(
        `http://kladr-api.ru/api.php?contentType=building&streetId=${streetId}&limit=20`,
        { next: { revalidate: 3600 } }
      )

      if (buildingsResponse.ok) {
        const buildingsData = await buildingsResponse.json()
        const buildings = buildingsData.result as KladrBuilding[] || []

        for (const building of buildings) {
          results.push({
            id: `external_${streetId}_${building.name}`, // Временный ID для внешних адресов
            street: streetName,
            house: building.name,
            comment: null,
            similarity: 0.7, // Средняя похожесть для внешних результатов
            full_address: `${streetName}, ${building.name}`,
            source: 'external'
          })
        }
      }
    }

    return results.slice(0, 10) // Ограничиваем 10 результатами
  } catch (error) {
    console.error('Error fetching from KLADR API:', error)
    return results
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    const supabase = createDirectClient()

    // Шаг 1: Поиск в локальной БД через fuzzy search
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: addresses, error } = await (supabase as any).rpc('search_addresses_fuzzy', {
      search_query: query.trim()
    })

    let localResults: SearchResult[] = []

    if (error) {
      // Если RPC функция еще не создана, используем простой ILIKE поиск
      console.error('RPC error, falling back to ILIKE search:', error)

      const { data: fallbackAddresses, error: fallbackError } = await supabase
        .from('zakaz_addresses')
        .select('*')
        .or(`street.ilike.%${query}%,house.ilike.%${query}%`)
        .order('street', { ascending: true })
        .order('house', { ascending: true })
        .limit(20)
        .returns<Address[]>()

      if (fallbackError) {
        console.error('Database error:', fallbackError)
        return NextResponse.json(
          { error: 'Failed to search addresses', details: fallbackError.message },
          { status: 500 }
        )
      }

      // Форматируем результаты
      localResults = (fallbackAddresses || []).map(addr => ({
        ...addr,
        similarity: 0.5,
        full_address: `${addr.street}, ${addr.house}`,
        source: 'local' as const
      }))
    } else {
      // Форматируем результаты с similarity
      localResults = (addresses as RpcSearchResult[] || []).map((addr) => ({
        id: addr.id,
        street: addr.street,
        house: addr.house,
        comment: addr.comment,
        similarity: addr.similarity || 0,
        full_address: `${addr.street}, ${addr.house}`,
        created_at: addr.created_at,
        updated_at: addr.updated_at,
        source: 'local' as const
      }))
    }

    // Шаг 2: Умная логика - запрашиваем КЛАДР API если:
    // 1. Найдено мало локальных результатов (< 3)
    // 2. ИЛИ нет точного совпадения с запросом
    let externalResults: SearchResult[] = []
    const MIN_LOCAL_RESULTS = 3

    // Проверяем есть ли точное совпадение среди локальных результатов
    const hasExactMatch = localResults.some(addr => {
      const fullAddress = `${addr.street}, ${addr.house}`.toLowerCase()
      const normalizedQuery = query.trim().toLowerCase()

      // Проверяем точное совпадение или совпадение без запятой
      return fullAddress === normalizedQuery ||
             fullAddress.replace(/,\s*/g, ' ') === normalizedQuery ||
             `${addr.street} ${addr.house}`.toLowerCase() === normalizedQuery
    })

    if (localResults.length < MIN_LOCAL_RESULTS || !hasExactMatch) {
      const reason = localResults.length < MIN_LOCAL_RESULTS
        ? `only ${localResults.length} local results`
        : 'no exact match found'
      console.log(`Fetching from KLADR API (${reason})...`)
      externalResults = await searchKladrAPI(query.trim())
    }

    // Объединяем результаты: сначала локальные, потом внешние
    const allResults = [...localResults, ...externalResults]

    return NextResponse.json({
      addresses: allResults,
      stats: {
        local: localResults.length,
        external: externalResults.length,
        total: allResults.length
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
