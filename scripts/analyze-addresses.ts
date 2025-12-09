import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_DIRECT_URL || 'http://78.140.57.33:8000'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY не установлен')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function analyzeAddresses() {
  console.log('Анализ адресов в заявках...\n')

  // Получаем все заявки с адресами
  const { data: applications, error } = await supabase
    .from('zakaz_applications')
    .select('id, street_and_house, address_details, legacy_id')
    .not('street_and_house', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Ошибка:', error.message)
    process.exit(1)
  }

  console.log(`Всего заявок с адресами: ${applications.length}\n`)

  // Известные города (для поиска в начале строки)
  const knownCities = ['Томск', 'Северск', 'г. Томск', 'г. Северск', 'г.Томск', 'г.Северск']

  // Статистика
  const stats = {
    withCity: [] as { id: string; city: string; address: string; legacy_id: number | null }[],
    withoutCity: [] as { id: string; address: string; legacy_id: number | null }[],
    cityCounts: {} as Record<string, number>,
  }

  for (const app of applications) {
    const address = app.street_and_house?.trim() || ''

    // Проверяем, начинается ли адрес с города
    let foundCity: string | null = null

    // Сначала проверяем известные города
    for (const city of knownCities) {
      if (address.toLowerCase().startsWith(city.toLowerCase())) {
        foundCity = city
        break
      }
    }

    // Если не нашли известный город, проверяем паттерн "Город, ..."
    if (!foundCity) {
      const match = address.match(/^([А-ЯЁа-яё][А-ЯЁа-яё\s-]+?)\s*,/)
      if (match) {
        const potentialCity = match[1].trim()
        // Проверяем, что это похоже на город (не на улицу)
        if (!potentialCity.toLowerCase().includes('ул') &&
            !potentialCity.toLowerCase().includes('пр') &&
            !potentialCity.toLowerCase().includes('пер') &&
            potentialCity.length < 30) {
          foundCity = potentialCity
        }
      }
    }

    if (foundCity) {
      stats.withCity.push({
        id: app.id,
        city: foundCity,
        address: address,
        legacy_id: app.legacy_id,
      })
      stats.cityCounts[foundCity] = (stats.cityCounts[foundCity] || 0) + 1
    } else {
      stats.withoutCity.push({
        id: app.id,
        address: address,
        legacy_id: app.legacy_id,
      })
    }
  }

  // Выводим статистику
  console.log('='.repeat(60))
  console.log('СТАТИСТИКА ПО ГОРОДАМ:')
  console.log('='.repeat(60))

  const sortedCities = Object.entries(stats.cityCounts).sort((a, b) => b[1] - a[1])
  for (const [city, count] of sortedCities) {
    console.log(`  ${city}: ${count} заявок`)
  }

  console.log(`\nВсего с городом: ${stats.withCity.length}`)
  console.log(`Без города в адресе: ${stats.withoutCity.length}`)

  // Примеры адресов с городом
  console.log('\n' + '='.repeat(60))
  console.log('ПРИМЕРЫ АДРЕСОВ С ГОРОДОМ (первые 10):')
  console.log('='.repeat(60))
  for (const item of stats.withCity.slice(0, 10)) {
    console.log(`  [${item.city}] ${item.address}`)
    if (item.legacy_id) console.log(`    (legacy_id: ${item.legacy_id})`)
  }

  // Примеры адресов без города
  console.log('\n' + '='.repeat(60))
  console.log('ПРИМЕРЫ АДРЕСОВ БЕЗ ГОРОДА (первые 20):')
  console.log('='.repeat(60))
  for (const item of stats.withoutCity.slice(0, 20)) {
    console.log(`  ${item.address}`)
    if (item.legacy_id) console.log(`    (legacy_id: ${item.legacy_id})`)
  }

  // Проверяем, есть ли legacy заявки без города
  const legacyWithoutCity = stats.withoutCity.filter(a => a.legacy_id !== null)
  const legacyWithCity = stats.withCity.filter(a => a.legacy_id !== null)

  console.log('\n' + '='.repeat(60))
  console.log('LEGACY ЗАЯВКИ (импортированные из старой системы):')
  console.log('='.repeat(60))
  console.log(`  С городом: ${legacyWithCity.length}`)
  console.log(`  Без города: ${legacyWithoutCity.length}`)

  console.log('\nГотово!')
}

analyzeAddresses()
