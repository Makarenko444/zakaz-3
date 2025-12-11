import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface NodeSearchResult {
  id: string
  street: string | null
  house: string | null
  comment: string | null
  presence_type?: string
  code?: string
  created_at?: string
  updated_at?: string
}

type AddressSource = 'local' | 'external_yandex' | 'external_osm'

interface SearchResult extends NodeSearchResult {
  similarity: number
  full_address: string
  source: AddressSource // Источник: локальная БД или внешний API
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

interface OpenStreetSearchResult {
  place_id: string
  display_name: string
  address?: {
    road?: string
    pedestrian?: string
    residential?: string
    house_number?: string
    city?: string
    town?: string
  }
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

    // Таймаут 5 секунд для внешнего API
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    let response: Response
    try {
      response = await fetch(url.toString(), {
        signal: controller.signal,
        next: { revalidate: 3600 } // Кешируем на 1 час
      })
    } finally {
      clearTimeout(timeoutId)
    }

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
        source: 'external_yandex'
      })
    }

    console.log(`Yandex API returned ${results.length} results for query: ${searchQuery}`)
    return results.slice(0, 10) // Ограничиваем 10 результатами
  } catch (error) {
    console.error('Error fetching from Yandex Geosuggest API:', error)
    return results
  }
}

async function searchOpenStreetMap(query: string): Promise<SearchResult[]> {
  /**
   * Поиск адресов через OpenStreetMap (Nominatim)
   * Используется для проверки написания адреса и подсказок при привязке
   */
  const results: SearchResult[] = []

  try {
    const searchQuery = query.includes('Томск') ? query : `Томск ${query}`

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '5')
    url.searchParams.set('q', searchQuery)
    url.searchParams.set('countrycodes', 'ru')
    url.searchParams.set('dedupe', '1')

    // Таймаут 5 секунд для внешнего API
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    let response: Response
    try {
      response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'zakaz-app/1.0 (support@zakaz.local)',
          'Accept-Language': 'ru',
        },
        next: { revalidate: 3600 }
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      console.error('OpenStreetMap API error:', response.status, await response.text())
      return results
    }

    const data = await response.json() as OpenStreetSearchResult[]

    for (const item of data) {
      const address = item.address || {}
      const street = address.road || address.pedestrian || address.residential
      const house = address.house_number

      if (!street || !house) continue

      results.push({
        id: `external_osm_${item.place_id}`,
        street,
        house,
        comment: item.display_name,
        similarity: 0.72,
        full_address: item.display_name,
        source: 'external_osm'
      })
    }

    console.log(`OpenStreetMap API returned ${results.length} results for query: ${searchQuery}`)
    return results
  } catch (error) {
    console.error('Error fetching from OpenStreetMap API:', error)
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

    // Шаг 1: Поиск в zakaz_addresses через fuzzy search
    // Пытаемся определить, ищет ли пользователь "улица + дом"
    const trimmedQuery = query.trim()

    // Попробуем разделить запрос на улицу и номер дома
    // Ищем паттерны вида "Кирова 555", "Кирова, 555", "Кирова,555"
    const streetHousePattern = /^(.+?)[\s,]+(\d+[а-яА-Яa-zA-Z]*)$/
    const match = trimmedQuery.match(streetHousePattern)

    let nodes: NodeSearchResult[] = []
    let searchError = null

    if (match) {
      // Запрос содержит и улицу и номер дома
      const streetPart = match[1].trim()
      const housePart = match[2].trim()

      // Ищем по двум условиям: улица содержит первую часть И дом содержит вторую часть
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('zakaz_addresses') as any)
        .select('id, city, street, house, building, address, comment, created_at, updated_at')
        .ilike('street', `%${streetPart}%`)
        .ilike('house', `%${housePart}%`)
        .order('street', { ascending: true })
        .order('house', { ascending: true })
        .limit(20)

      nodes = data || []
      searchError = error

      console.log(`Search with split query: street="${streetPart}" AND house="${housePart}" -> ${nodes.length} results`)
    } else {
      // Обычный поиск по всем полям
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('zakaz_addresses') as any)
        .select('id, city, street, house, building, address, comment, created_at, updated_at')
        .or(`city.ilike.%${trimmedQuery}%,street.ilike.%${trimmedQuery}%,house.ilike.%${trimmedQuery}%,address.ilike.%${trimmedQuery}%`)
        .order('street', { ascending: true })
        .order('house', { ascending: true })
        .limit(20)

      nodes = data || []
      searchError = error

      console.log(`Search with simple query: "${trimmedQuery}" -> ${nodes.length} results`)
    }

    let localResults: SearchResult[] = []

    if (searchError) {
      console.error('Database error:', searchError)
      return NextResponse.json(
        { error: 'Failed to search addresses', details: searchError.message },
        { status: 500 }
      )
    }

    // Форматируем результаты и находим узлы для каждого адреса
    const addressesWithNodes = await Promise.all(
      (nodes || [])
        .filter(node => node.street && node.house) // Только адреса с заполненными street и house
        .map(async (address) => {
          // Для каждого адреса находим первый узел (если есть)
          const { data: nodeData } = await supabase
            .from('zakaz_nodes')
            .select('id')
            .eq('address_id', address.id)
            .limit(1)

          // nodeData будет массивом или null
          const firstNode = (nodeData && Array.isArray(nodeData) && nodeData.length > 0 ? nodeData[0] : null) as { id: string } | null

          return {
            ...address,
            node_id: firstNode ? firstNode.id : null, // ID узла, если он существует
            similarity: 0.5,
            full_address: `${address.street}, ${address.house}`,
            source: 'local' as const
          }
        })
    )

    localResults = addressesWithNodes

    const _normalize = (value: string) => value.trim().toLowerCase().replace(/,+/g, ' ').replace(/\s+/g, ' ')

    // Шаг 2: Умная логика - запрашиваем внешние API если:
    // 1. Найдено мало локальных результатов (< 3)
    // 2. ИЛИ нет точного совпадения с запросом
    let externalResults: SearchResult[] = []
    let _openStreetResults: SearchResult[] = []
    const MIN_LOCAL_RESULTS = 3

    // Проверяем есть ли точное совпадение среди локальных результатов
    const hasExactMatch = localResults.some(node => {
      if (!node.street || !node.house) return false
      const fullAddress = `${node.street}, ${node.house}`.toLowerCase()
      const normalizedQuery = query.trim().toLowerCase()

      // Проверяем точное совпадение или совпадение без запятой
      return fullAddress === normalizedQuery ||
             fullAddress.replace(/,\s*/g, ' ') === normalizedQuery ||
             `${node.street} ${node.house}`.toLowerCase() === normalizedQuery
    })

    const triggeredExternalSearch = localResults.length < MIN_LOCAL_RESULTS || !hasExactMatch

    if (triggeredExternalSearch) {
      const reason = localResults.length < MIN_LOCAL_RESULTS
        ? `only ${localResults.length} local results`
        : 'no exact match found'
      console.log(`Fetching from external geocoders (${reason})...`)
      const trimmedQuery = query.trim()
      const [yandexResults, osmResults] = await Promise.all([
        searchYandexAPI(trimmedQuery),
        searchOpenStreetMap(trimmedQuery)
      ])

      externalResults = yandexResults
      _openStreetResults = osmResults
    }

    // Объединяем результаты: сначала локальные, потом внешние
    const allResults = [...localResults, ...externalResults]
    const yandexCount = externalResults.filter(result => result.source === 'external_yandex').length
    const osmCount = externalResults.filter(result => result.source === 'external_osm').length

    return NextResponse.json({
      addresses: allResults,
      stats: {
        local: localResults.length,
        external: externalResults.length,
        total: allResults.length,
        yandex: yandexCount,
        openstreet: osmCount
      },
      fallback: triggeredExternalSearch,
      debug: {
        query: query.trim(),
        hasExactMatch,
        triggeredExternalSearch
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
