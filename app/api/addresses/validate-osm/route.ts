import { NextResponse } from 'next/server'

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address || address.trim().length === 0) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      )
    }

    // Добавляем "Томск" к запросу если его нет
    const searchQuery = address.includes('Томск') ? address : `Томск ${address}`

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
      return NextResponse.json({
        status: 'no_match',
        message: 'Не удалось проверить адрес через OpenStreetMap'
      })
    }

    const data = await response.json() as OpenStreetSearchResult[]

    if (data.length === 0) {
      return NextResponse.json({
        status: 'no_match',
        message: 'Адрес не найден в OpenStreetMap'
      })
    }

    // Собираем все найденные варианты написания
    const allSuggestions = data
      .filter(item => {
        const addr = item.address || {}
        const street = addr.road || addr.pedestrian || addr.residential
        const house = addr.house_number
        return street && house
      })
      .map(item => {
        const addr = item.address || {}
        const street = addr.road || addr.pedestrian || addr.residential
        const house = addr.house_number
        return `${street}, ${house}`
      })

    // Убираем дубликаты
    const suggestions = Array.from(new Set(allSuggestions))

    if (suggestions.length === 0) {
      return NextResponse.json({
        status: 'no_match',
        message: 'Не найдено подходящих адресов'
      })
    }

    // Проверяем есть ли точное совпадение
    const normalizedAddress = address.trim().toLowerCase().replace(/\s+/g, ' ')
    const exactMatch = suggestions.some(sugg =>
      sugg.toLowerCase().replace(/\s+/g, ' ').includes(normalizedAddress) ||
      normalizedAddress.includes(sugg.toLowerCase().replace(/\s+/g, ' '))
    )

    if (exactMatch) {
      return NextResponse.json({
        status: 'match',
        suggestion: suggestions[0],
        message: 'Написание совпадает с данными OSM'
      })
    }

    return NextResponse.json({
      status: 'suggestions',
      suggestions: suggestions.slice(0, 3),
      message: 'OSM предлагает уточнения для написания'
    })

  } catch (error) {
    console.error('Error validating address with OSM:', error)
    return NextResponse.json({
      status: 'no_match',
      message: 'Ошибка при проверке адреса'
    }, { status: 500 })
  }
}
