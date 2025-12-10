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

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'zakaz-app/1.0 (support@zakaz.local)',
        'Accept-Language': 'ru',
      },
      next: { revalidate: 3600 }
    })

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

/**
 * Нормализует название улицы для поиска
 * Удаляет типы улиц (проспект, улица, тракт и т.д.) для более гибкого поиска
 * Работает как с типом в начале, так и в конце названия
 *
 * Примеры:
 * - "проспект Ленина" -> "Ленина" (тип в начале)
 * - "пр. Ленина" -> "Ленина" (сокращение в начале)
 * - "Иркутский тракт" -> "Иркутский" (тип в конце)
 * - "ул. Кирова" -> "Кирова"
 * - "Кирова" -> "Кирова" (без изменений)
 */
function normalizeStreetName(street: string): string {
  let result = street.trim()

  // Типы улиц для удаления из НАЧАЛА (с пробелом после)
  const prefixes = [
    // Полные формы
    'проспект ', 'улица ', 'переулок ', 'площадь ', 'бульвар ',
    'шоссе ', 'тракт ', 'аллея ', 'набережная ', 'микрорайон ', 'проезд ', 'тупик ',
    // Сокращённые формы с точкой
    'пр-т. ', 'пр-т ', 'пр. ', 'ул. ', 'пер. ', 'пл. ', 'б-р. ', 'б-р ',
    'ш. ', 'наб. ', 'мкр. ', 'пр-д. ', 'пр-д ',
    // Короткие сокращения
    'пр ', 'ул ',
  ]

  // Типы улиц для удаления из КОНЦА (с пробелом перед)
  const suffixes = [
    ' проспект', ' улица', ' переулок', ' площадь', ' бульвар',
    ' шоссе', ' тракт', ' аллея', ' набережная', ' микрорайон', ' проезд', ' тупик',
    ' пр-т', ' пр.', ' ул.', ' пер.', ' пл.', ' б-р', ' ш.', ' наб.', ' мкр.',
  ]

  const lowerResult = result.toLowerCase()

  // Удаляем тип из начала
  for (const prefix of prefixes) {
    if (lowerResult.startsWith(prefix)) {
      result = result.substring(prefix.length).trim()
      break
    }
  }

  // Удаляем тип из конца
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
    // Ищем паттерны вида "Кирова 555", "Кирова, 555", "Кирова,555", "Иркутский тракт, 193а, 244"
    // Важно: берём ПЕРВЫЙ номер дома (без $ в конце), чтобы "193а, 244" дало "193а", а не "244"
    const streetHousePattern = /^(.+?)[\s,]+(\d+[а-яА-Яa-zA-Z]*)/
    const match = trimmedQuery.match(streetHousePattern)

    let nodes: NodeSearchResult[] = []
    let searchError = null

    if (match) {
      // Запрос содержит и улицу и номер дома
      const streetPartRaw = match[1].trim()
      const housePart = match[2].trim()

      // Нормализуем название улицы - удаляем тип улицы для более гибкого поиска
      // "проспект Ленина" -> "Ленина", "ул. Кирова" -> "Кирова"
      const streetPartNormalized = normalizeStreetName(streetPartRaw)

      // Ищем по двум условиям: улица содержит название И дом содержит номер
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('zakaz_addresses') as any)
        .select('id, city, street, house, building, address, comment, created_at, updated_at')
        .ilike('street', `%${streetPartNormalized}%`)
        .ilike('house', `%${housePart}%`)
        .order('street', { ascending: true })
        .order('house', { ascending: true })
        .limit(20)

      nodes = data || []
      searchError = error

      console.log(`Search with split query: street="${streetPartRaw}" (normalized: "${streetPartNormalized}") AND house="${housePart}" -> ${nodes.length} results`)
    } else {
      // Обычный поиск по всем полям
      // Нормализуем запрос - удаляем тип улицы для более гибкого поиска
      const normalizedQuery = normalizeStreetName(trimmedQuery)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('zakaz_addresses') as any)
        .select('id, city, street, house, building, address, comment, created_at, updated_at')
        .or(`city.ilike.%${normalizedQuery}%,street.ilike.%${normalizedQuery}%,house.ilike.%${normalizedQuery}%,address.ilike.%${normalizedQuery}%`)
        .order('street', { ascending: true })
        .order('house', { ascending: true })
        .limit(20)

      nodes = data || []
      searchError = error

      console.log(`Search with simple query: "${trimmedQuery}" (normalized: "${normalizedQuery}") -> ${nodes.length} results`)
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
