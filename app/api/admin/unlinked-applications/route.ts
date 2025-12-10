import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'

interface Address {
  id: string
  city: string
  street: string | null
  house: string | null
  building: string | null
  address: string
}

interface ApplicationWithSuggestions {
  id: string
  application_number: number
  city: string
  street_and_house: string | null
  address_details: string | null
  customer_type: string
  customer_fullname: string
  created_at: string
  suggested_addresses: Address[]
}

// Функция для нормализации строки для сравнения
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,\-\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/улица|ул\.?|проспект|пр\.?|пр-т|переулок|пер\.?|бульвар|б-р|шоссе|ш\.?|набережная|наб\.?|площадь|пл\.?|проезд|пр-д/gi, '')
    .replace(/дом|д\.?|корпус|корп\.?|к\.?|строение|стр\.?/gi, '')
    .trim()
}

// Извлекаем ключевые слова из адреса для поиска
function extractSearchTerms(streetAndHouse: string): string[] {
  const normalized = streetAndHouse
    .replace(/[.,\-\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Убираем служебные слова
  const cleaned = normalized
    .replace(/улица|ул\.?|проспект|пр\.?|пр-т|переулок|пер\.?|бульвар|б-р|шоссе|ш\.?|набережная|наб\.?|площадь|пл\.?|проезд|пр-д/gi, '')
    .replace(/дом|д\.?|корпус|корп\.?|к\.?|строение|стр\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Разбиваем на слова длиной >= 2 символа
  return cleaned.split(' ').filter(word => word.length >= 2)
}

// Вычисляем схожесть между двумя строками (простой алгоритм)
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeForComparison(str1)
  const norm2 = normalizeForComparison(str2)

  if (norm1 === norm2) return 1

  const words1 = norm1.split(' ').filter(w => w.length >= 2)
  const words2 = norm2.split(' ').filter(w => w.length >= 2)

  if (words1.length === 0 || words2.length === 0) return 0

  // Считаем совпадающие слова
  let matchCount = 0
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchCount++
        break
      }
    }
  }

  return matchCount / Math.max(words1.length, words2.length)
}

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession(request)

    // Только админы могут использовать этот endpoint
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const supabase = createDirectClient()
    const searchParams = request.nextUrl.searchParams

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const cityFilter = searchParams.get('city')
    const search = searchParams.get('search')

    // Получаем непривязанные заявки (address_id IS NULL или address_match_status = 'unmatched')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('zakaz_applications') as any)
      .select('id, application_number, city, street_and_house, address_details, customer_type, customer_fullname, created_at', { count: 'exact' })
      .is('address_id', null)
      .not('street_and_house', 'is', null)
      .order('created_at', { ascending: false })

    // Фильтр по городу
    if (cityFilter) {
      query = query.eq('city', cityFilter)
    }

    // Поиск по адресу или клиенту
    if (search) {
      query = query.or(`street_and_house.ilike.%${search}%,customer_fullname.ilike.%${search}%`)
    }

    // Пагинация
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: applications, error: appError, count } = await query

    if (appError) {
      console.error('Error fetching unlinked applications:', appError)
      return NextResponse.json({ error: appError.message }, { status: 500 })
    }

    if (!applications || applications.length === 0) {
      return NextResponse.json({
        applications: [],
        stats: { total: 0, with_suggestions: 0, without_suggestions: 0 },
        pagination: { page, limit, total: 0, totalPages: 0 }
      })
    }

    // Получаем все адреса из справочника для поиска подсказок
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allAddresses, error: addrError } = await (supabase.from('zakaz_addresses') as any)
      .select('id, city, street, house, building, address')
      .order('address')

    if (addrError) {
      console.error('Error fetching addresses:', addrError)
      return NextResponse.json({ error: addrError.message }, { status: 500 })
    }

    // Для каждой заявки находим похожие адреса
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applicationsWithSuggestions: ApplicationWithSuggestions[] = applications.map((app: any) => {
      const suggestions: (Address & { similarity: number })[] = []

      if (app.street_and_house && allAddresses) {
        const searchTerms = extractSearchTerms(app.street_and_house)

        for (const addr of allAddresses) {
          // Фильтруем по городу если город указан в заявке
          if (app.city && addr.city && app.city.toLowerCase() !== addr.city.toLowerCase()) {
            continue
          }

          // Вычисляем схожесть
          const similarity = calculateSimilarity(app.street_and_house, addr.address || '')

          // Также проверяем совпадение отдельных терминов
          const addrNormalized = normalizeForComparison(addr.address || '')
          const hasTermMatch = searchTerms.some(term => addrNormalized.includes(term.toLowerCase()))

          if (similarity >= 0.3 || hasTermMatch) {
            suggestions.push({
              ...addr,
              similarity: Math.max(similarity, hasTermMatch ? 0.3 : 0)
            })
          }
        }

        // Сортируем по схожести и берём топ-5
        suggestions.sort((a, b) => b.similarity - a.similarity)
      }

      return {
        ...app,
        suggested_addresses: suggestions.slice(0, 5).map(({ similarity: _similarity, ...addr }) => addr)
      }
    })

    // Статистика
    const withSuggestions = applicationsWithSuggestions.filter(a => a.suggested_addresses.length > 0).length
    const withoutSuggestions = applicationsWithSuggestions.length - withSuggestions

    return NextResponse.json({
      applications: applicationsWithSuggestions,
      stats: {
        total: count || 0,
        with_suggestions: withSuggestions,
        without_suggestions: withoutSuggestions
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in GET /api/admin/unlinked-applications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Массовая привязка нескольких заявок к одному адресу
export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const supabase = createDirectClient()
    const body = await request.json()

    const { application_ids, address_id } = body

    if (!application_ids || !Array.isArray(application_ids) || application_ids.length === 0) {
      return NextResponse.json(
        { error: 'application_ids is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!address_id) {
      return NextResponse.json(
        { error: 'address_id is required' },
        { status: 400 }
      )
    }

    // Проверяем, что адрес существует
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: address, error: addrError } = await (supabase.from('zakaz_addresses') as any)
      .select('id')
      .eq('id', address_id)
      .single()

    if (addrError || !address) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      )
    }

    // Обновляем заявки
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('zakaz_applications') as any)
      .update({
        address_id: address_id,
        address_match_status: 'manual_matched',
        updated_by: session.user.id,
        updated_at: new Date().toISOString()
      })
      .in('id', application_ids)
      .select('id')

    if (error) {
      console.error('Error linking applications:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      linked_count: data?.length || 0
    })
  } catch (error) {
    console.error('Error in POST /api/admin/unlinked-applications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
