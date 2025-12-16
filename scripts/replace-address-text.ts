/**
 * Скрипт для массовой замены текста в адресах
 * Запуск: npx ts-node scripts/replace-address-text.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Загружаем переменные окружения
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Ошибка: Не заданы NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Параметры замены
const SEARCH = 'просп.'
const REPLACE = 'проспект'

async function main() {
  console.log(`\n=== Замена "${SEARCH}" на "${REPLACE}" в адресах ===\n`)

  // 1. Находим все записи для замены в поле street
  const { data: streetMatches, error: streetError } = await supabase
    .from('zakaz_addresses')
    .select('id, street, address')
    .ilike('street', `%${SEARCH}%`)

  if (streetError) {
    console.error('Ошибка поиска:', streetError)
    process.exit(1)
  }

  console.log(`Найдено записей с "${SEARCH}" в поле street: ${streetMatches?.length || 0}`)

  if (streetMatches && streetMatches.length > 0) {
    console.log('\nПримеры (до 10):')
    streetMatches.slice(0, 10).forEach(r => {
      console.log(`  - ${r.street}`)
    })

    console.log('\nВыполняю замену...')

    let updated = 0
    let errors = 0

    for (const row of streetMatches) {
      const newStreet = row.street?.replace(new RegExp(SEARCH, 'gi'), REPLACE)
      const newAddress = row.address?.replace(new RegExp(SEARCH, 'gi'), REPLACE)

      const { error: updateError } = await supabase
        .from('zakaz_addresses')
        .update({
          street: newStreet,
          address: newAddress
        })
        .eq('id', row.id)

      if (updateError) {
        console.error(`  Ошибка обновления ID ${row.id}:`, updateError.message)
        errors++
      } else {
        updated++
      }
    }

    console.log(`\nГотово! Обновлено: ${updated}, ошибок: ${errors}`)
  }

  // 2. Проверяем, есть ли записи где в address есть "просп." но в street нет (на всякий случай)
  const { data: addressOnlyMatches } = await supabase
    .from('zakaz_addresses')
    .select('id, street, address')
    .ilike('address', `%${SEARCH}%`)
    .not('street', 'ilike', `%${SEARCH}%`)

  if (addressOnlyMatches && addressOnlyMatches.length > 0) {
    console.log(`\nНайдено ${addressOnlyMatches.length} записей где "${SEARCH}" только в address:`)
    addressOnlyMatches.slice(0, 5).forEach(r => {
      console.log(`  - ${r.address}`)
    })

    console.log('\nОбновляю поле address...')

    let updated = 0
    for (const row of addressOnlyMatches) {
      const newAddress = row.address?.replace(new RegExp(SEARCH, 'gi'), REPLACE)

      const { error } = await supabase
        .from('zakaz_addresses')
        .update({ address: newAddress })
        .eq('id', row.id)

      if (!error) updated++
    }

    console.log(`Обновлено: ${updated}`)
  }

  console.log('\n=== Завершено ===\n')
}

main().catch(console.error)
