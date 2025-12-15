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

interface AddressWithCounts {
  id: string
  city: string
  street: string | null
  house: string | null
  building: string | null
  address: string
  linked_applications: number
  potential_applications: number
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

// Извлекаем улицу и номер дома из строки адреса заявки
function parseStreetAndHouse(address: string): { street: string, house: string } {
  // ВАЖНО: сначала удаляем префикс ДО замены спецсимволов,
  // чтобы "пр-т" и "б-р" корректно распознавались
  const lowerCase = address.toLowerCase().trim()

  // Убираем префиксы улиц (до замены спецсимволов!)
  // Варианты: улица/ул, проспект/просп/пр/пр-т, переулок/пер, бульвар/б-р, шоссе/ш, набережная/наб, площадь/пл, проезд/пр-д
  const withoutPrefix = lowerCase
    .replace(/^(улица|ул\.?|проспект|просп\.?|пр\.?|пр-т|переулок|пер\.?|бульвар|бул\.?|б-р|шоссе|ш\.?|набережная|наб\.?|площадь|пл\.?|проезд|пр-д)\s*/i, '')
    .trim()

  // Теперь заменяем спецсимволы на пробелы и нормализуем
  const normalized = withoutPrefix
    .replace(/[.,\-\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Ищем номер дома - число (возможно с буквой) в конце
  const houseMatch = normalized.match(/^(.+?)\s+(\d+[а-яa-z]?\/?[\dа-яa-z]*)(?:\s|$)/i)

  if (houseMatch) {
    return {
      street: houseMatch[1].trim(),
      house: houseMatch[2].trim()
    }
  }

  // Если не нашли дом, возвращаем всю строку как улицу
  return {
    street: normalized,
    house: ''
  }
}

// Нормализуем название улицы для сравнения
function normalizeStreet(street: string): string {
  // ВАЖНО: сначала удаляем префикс ДО замены спецсимволов,
  // чтобы "пр-т" и "б-р" корректно распознавались
  // Варианты: улица/ул, проспект/просп/пр/пр-т, переулок/пер, бульвар/б-р, шоссе/ш, набережная/наб, площадь/пл, проезд/пр-д
  const withoutPrefix = street
    .toLowerCase()
    .replace(/^(улица|ул\.?|проспект|просп\.?|пр\.?|пр-т|переулок|пер\.?|бульвар|бул\.?|б-р|шоссе|ш\.?|набережная|наб\.?|площадь|пл\.?|проезд|пр-д)\s*/i, '')
    .trim()

  // Теперь заменяем спецсимволы
  return withoutPrefix
    .replace(/[.,\-\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Сравниваем названия улиц
function compareStreets(street1: string, street2: string): boolean {
  const norm1 = normalizeStreet(street1)
  const norm2 = normalizeStreet(street2)

  if (!norm1 || !norm2) return false
  if (norm1 === norm2) return true

  // Проверяем, начинается ли одно название с другого (для сокращений)
  if (norm1.length >= 3 && norm2.length >= 3) {
    return norm1.startsWith(norm2) || norm2.startsWith(norm1)
  }

  return false
}

// Сравниваем номера домов
function compareHouses(house1: string, house2: string): number {
  if (!house1 || !house2) return 0

  const norm1 = house1.toLowerCase().replace(/\s/g, '')
  const norm2 = house2.toLowerCase().replace(/\s/g, '')

  if (norm1 === norm2) return 1

  // Извлекаем базовый номер (только цифры)
  const num1 = norm1.match(/^(\d+)/)?.[1]
  const num2 = norm2.match(/^(\d+)/)?.[1]

  // Номера должны совпадать точно!
  if (num1 && num2 && num1 === num2) {
    // Базовые номера совпадают, но есть различия в буквах/корпусах
    return 0.8
  }

  return 0
}

// Вычисляем схожесть адресов (строгий алгоритм)
function calculateSimilarity(appAddress: string, dirAddress: string, dirStreet?: string | null, dirHouse?: string | null): number {
  // Парсим адрес заявки
  const parsed = parseStreetAndHouse(appAddress)

  // Для адреса из справочника используем поля street и house если доступны
  const targetStreet = dirStreet ? normalizeStreet(dirStreet) : parseStreetAndHouse(dirAddress).street
  const targetHouse = dirHouse || parseStreetAndHouse(dirAddress).house

  // Если улицы не совпадают - сразу 0
  if (!compareStreets(parsed.street, targetStreet)) {
    return 0
  }

  // Улицы совпадают, проверяем дом
  const houseSimilarity = compareHouses(parsed.house, targetHouse)

  if (houseSimilarity === 1) {
    return 1 // Полное совпадение
  } else if (houseSimilarity > 0) {
    return 0.8 // Частичное совпадение дома (базовый номер тот же)
  } else if (!parsed.house || !targetHouse) {
    return 0.5 // Улица совпала, но дом не указан в одном из адресов
  }

  // Улица совпала, но дом не совпадает
  return 0.3
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
    const mode = searchParams.get('mode') || 'applications' // 'applications' или 'addresses'
    const addressId = searchParams.get('address_id') // для режима addresses
    const sortField = searchParams.get('sort_field') || 'address' // поле сортировки
    const sortDirection = searchParams.get('sort_direction') || 'asc' // направление сортировки

    // Получаем общую статистику по заявкам
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: totalApplications } = await (supabase.from('zakaz_applications') as any)
      .select('id', { count: 'exact', head: true })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: linkedApplications } = await (supabase.from('zakaz_applications') as any)
      .select('id', { count: 'exact', head: true })
      .not('address_id', 'is', null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: unlinkedApplications } = await (supabase.from('zakaz_applications') as any)
      .select('id', { count: 'exact', head: true })
      .is('address_id', null)
      .not('street_and_house', 'is', null)

    const globalStats = {
      total_applications: totalApplications || 0,
      linked: linkedApplications || 0,
      unlinked: unlinkedApplications || 0
    }

    // Режим "от адреса к заявкам"
    if (mode === 'addresses') {
      // Получаем адреса с количеством привязанных заявок
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let addressQuery = (supabase.from('zakaz_addresses') as any)
        .select(`
          id, city, street, house, building, address,
          zakaz_applications(id)
        `, { count: 'exact' })

      if (cityFilter) {
        addressQuery = addressQuery.eq('city', cityFilter)
      }

      if (search) {
        // Разбиваем поиск на слова и ищем каждое слово отдельно (AND логика)
        const searchWords = search.trim().split(/\s+/).filter(w => w.length >= 1)
        for (const word of searchWords) {
          addressQuery = addressQuery.ilike('address', `%${word}%`)
        }
      }

      // Сортировка по полю (для полей из БД)
      if (sortField === 'address' || sortField === 'city') {
        addressQuery = addressQuery.order(sortField, { ascending: sortDirection === 'asc' })
      } else {
        // Для вычисляемых полей сортируем после получения данных
        addressQuery = addressQuery.order('address', { ascending: true })
      }

      // Если выбран конкретный адрес - возвращаем заявки для него
      if (addressId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: addressData } = await (supabase.from('zakaz_addresses') as any)
          .select('id, city, street, house, building, address')
          .eq('id', addressId)
          .single()

        if (!addressData) {
          return NextResponse.json({ error: 'Address not found' }, { status: 404 })
        }

        // Получаем все непривязанные заявки
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: allUnlinked } = await (supabase.from('zakaz_applications') as any)
          .select('id, application_number, city, street_and_house, address_details, customer_type, customer_fullname, created_at')
          .is('address_id', null)
          .not('street_and_house', 'is', null)
          .order('created_at', { ascending: false })

        // Фильтруем по схожести с выбранным адресом (строгий алгоритм)
        const matchingApplications = (allUnlinked || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((app: any) => {
            // Используем строгий алгоритм с учётом полей street и house из справочника
            const similarity = calculateSimilarity(
              app.street_and_house || '',
              addressData.address || '',
              addressData.street,
              addressData.house
            )

            // Проверяем совпадение города
            const cityMatch = !app.city || !addressData.city ||
              app.city.toLowerCase() === addressData.city.toLowerCase()

            return {
              ...app,
              similarity,
              cityMatch
            }
          })
          // Показываем только если улица совпала (similarity > 0)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((app: any) => app.cityMatch && app.similarity > 0)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => b.similarity - a.similarity)

        return NextResponse.json({
          mode: 'address_detail',
          address: addressData,
          applications: matchingApplications,
          stats: globalStats
        })
      }

      // Пагинация для списка адресов
      const offset = (page - 1) * limit
      addressQuery = addressQuery.range(offset, offset + limit - 1)

      const { data: addresses, error: addrError, count: addrCount } = await addressQuery

      if (addrError) {
        return NextResponse.json({ error: addrError.message }, { status: 500 })
      }

      // Для каждого адреса подсчитываем потенциальные заявки
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allUnlinked } = await (supabase.from('zakaz_applications') as any)
        .select('id, city, street_and_house')
        .is('address_id', null)
        .not('street_and_house', 'is', null)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let addressesWithCounts: AddressWithCounts[] = (addresses || []).map((addr: any) => {
        // Количество привязанных заявок
        const linkedCount = addr.zakaz_applications?.length || 0

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const potentialCount = (allUnlinked || []).filter((app: any) => {
          const similarity = calculateSimilarity(app.street_and_house || '', addr.address || '', addr.street, addr.house)
          const cityMatch = !app.city || !addr.city ||
            app.city.toLowerCase() === addr.city.toLowerCase()
          // Только если улица совпала (similarity > 0)
          return cityMatch && similarity > 0
        }).length

        return {
          id: addr.id,
          city: addr.city,
          street: addr.street,
          house: addr.house,
          building: addr.building,
          address: addr.address,
          linked_applications: linkedCount,
          potential_applications: potentialCount
        }
      })

      // Сортировка по вычисляемым полям
      if (sortField === 'linked_applications' || sortField === 'potential_applications') {
        addressesWithCounts = addressesWithCounts.sort((a: AddressWithCounts, b: AddressWithCounts) => {
          const aVal = a[sortField] || 0
          const bVal = b[sortField] || 0
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        })
      }

      return NextResponse.json({
        mode: 'addresses',
        addresses: addressesWithCounts,
        stats: globalStats,
        pagination: {
          page,
          limit,
          total: addrCount || 0,
          totalPages: Math.ceil((addrCount || 0) / limit)
        }
      })
    }

    // Режим по умолчанию - "от заявок к адресам"
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
      // Разбиваем поиск на слова и ищем каждое слово отдельно (AND логика)
      const searchWords = search.trim().split(/\s+/).filter(w => w.length >= 1)
      for (const word of searchWords) {
        query = query.ilike('street_and_house', `%${word}%`)
      }
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
        mode: 'applications',
        applications: [],
        stats: {
          ...globalStats,
          total: 0,
          with_suggestions: 0,
          without_suggestions: 0
        },
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

    // Для каждой заявки находим похожие адреса (строгий алгоритм)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applicationsWithSuggestions: ApplicationWithSuggestions[] = applications.map((app: any) => {
      const suggestions: (Address & { similarity: number })[] = []

      if (app.street_and_house && allAddresses) {
        for (const addr of allAddresses) {
          // Фильтруем по городу если город указан в заявке
          if (app.city && addr.city && app.city.toLowerCase() !== addr.city.toLowerCase()) {
            continue
          }

          // Вычисляем схожесть с учётом полей street и house из справочника
          const similarity = calculateSimilarity(
            app.street_and_house,
            addr.address || '',
            addr.street,
            addr.house
          )

          // Показываем только если улица совпала (similarity > 0)
          if (similarity > 0) {
            suggestions.push({
              ...addr,
              similarity
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
      mode: 'applications',
      applications: applicationsWithSuggestions,
      stats: {
        ...globalStats,
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
