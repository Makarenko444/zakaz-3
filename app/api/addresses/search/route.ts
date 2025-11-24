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

interface YandexSuggestResult {
  title: {
    text: string
  }
  subtitle?: {
    text: string
  }
  address?: {
    formatted_address: string
    component: Array<{
      name: string
      kind: string[]
    }>
  }
  uri?: string
}

interface YandexSuggestResponse {
  results: YandexSuggestResult[]
}

async function searchYandexAPI(query: string): Promise<SearchResult[]> {
  /**
   * Поиск адресов через Яндекс Геосаджест API
   * Используется когда в локальной БД мало результатов или нет точного совпадения
   */
  const results: SearchResult[] = []
  const apiKey = process.env.YANDEX_GEOSUGGEST_API_KEY

  if (!apiKey) {
    console.error('YANDEX_GEOSUGGEST_API_KEY not configured')
    return results
  }

  try {
    // Добавляем "Томск" к запросу для поиска в нужном городе
    const searchQuery = query.includes('Томск') ? query : `Томск ${query}`

    // Координаты Томска для фокусировки поиска
    const tomskCoords = '84.97,56.5'

    const url = new URL('https://suggest-maps.yandex.ru/v1/suggest')
    url.searchParams.set('apikey', apiKey)
    url.searchParams.set('text', searchQuery)
    url.searchParams.set('print_address', '1')
    url.searchParams.set('types', 'house')
    url.searchParams.set('ll', tomskCoords)
    url.searchParams.set('results', '10')

    const response = await fetch(url.toString(), {
      next: { revalidate: 3600 } // Кешируем на 1 час
    })

    if (!response.ok) {
      console.error('Yandex Geosuggest API error:', response.status, await response.text())
      return results
    }

    const data = await response.json() as YandexSuggestResponse

    for (const item of data.results || []) {
      if (!item.address) continue

      // Извлекаем улицу и номер дома из компонентов адреса
      const components = item.address.component || []
      const streetComponent = components.find(c => c.kind.includes('street'))
      const houseComponent = components.find(c => c.kind.includes('house'))

      if (!streetComponent || !houseComponent) continue

      const street = streetComponent.name
      const house = houseComponent.name

      results.push({
        id: `external_yandex_${street}_${house}`, // Временный ID для внешних адресов
        street: street,
        house: house,
        comment: null,
        similarity: 0.7, // Средняя похожесть для внешних результатов
        full_address: item.address.formatted_address || `${street}, ${house}`,
        source: 'external'
      })
    }

    console.log(`Yandex API returned ${results.length} results for query: ${searchQuery}`)
    return results.slice(0, 10) // Ограничиваем 10 результатами
  } catch (error) {
    console.error('Error fetching from Yandex Geosuggest API:', error)
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

    // Шаг 2: Умная логика - запрашиваем Яндекс API если:
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
      console.log(`Fetching from Yandex Geosuggest API (${reason})...`)
      externalResults = await searchYandexAPI(query.trim())
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
