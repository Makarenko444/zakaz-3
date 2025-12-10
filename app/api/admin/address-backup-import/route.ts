import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'

// Парсинг TSV
function parseTSV<T>(text: string): T[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split('\t').map(h => h.trim())
  const rows: T[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t')
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || ''
    })
    rows.push(row as T)
  }

  return rows
}

// Получить значение или null (фильтруя NULL строки)
function getValueOrNull(value: string | undefined | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.toUpperCase() === 'NULL') return null
  return trimmed
}

interface LegacyOrder {
  nid: string
  field_all_adres_value: string
  field_all_adres2_value: string
}

export async function POST(request: NextRequest) {
  // Проверка авторизации
  const session = await validateSession(request)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const ordersFile = formData.get('orders') as File | null

  if (!ordersFile) {
    return NextResponse.json({ error: 'Требуется файл orders.tsv' }, { status: 400 })
  }

  const ordersText = await ordersFile.text()
  const orders = parseTSV<LegacyOrder>(ordersText)

  const supabase = createDirectClient()

  let updated = 0
  let skipped = 0
  let notFound = 0
  let errors = 0

  for (const order of orders) {
    const legacyId = order.nid?.trim()
    if (!legacyId) {
      skipped++
      continue
    }

    const streetAndHouse = getValueOrNull(order.field_all_adres_value)
    const addressDetails = getValueOrNull(order.field_all_adres2_value)

    // Обновляем заявку по legacy_id
    const { data, error } = await supabase
      .from('zakaz_applications')
      .update({
        street_and_house_original: streetAndHouse,
        address_details_original: addressDetails,
      } as never)
      .eq('legacy_id', parseInt(legacyId))
      .select('id')

    if (error) {
      errors++
    } else if (!data || data.length === 0) {
      notFound++
    } else {
      updated++
    }
  }

  return NextResponse.json({
    success: true,
    total: orders.length,
    updated,
    skipped,
    notFound,
    errors,
  })
}

// Тип для статистики оригинальных адресов
interface OriginalAddressRow {
  id: string
  street_and_house_original: string | null
  address_details_original: string | null
}

// GET - получить статистику заполненности полей
export async function GET(request: NextRequest) {
  const session = await validateSession(request)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createDirectClient()

  const { data, error } = await supabase
    .from('zakaz_applications')
    .select('id, street_and_house_original, address_details_original') as { data: OriginalAddressRow[] | null; error: { message: string } | null }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const total = data?.length || 0
  const withOriginalStreet = data?.filter(d => d.street_and_house_original).length || 0
  const withOriginalDetails = data?.filter(d => d.address_details_original).length || 0

  return NextResponse.json({
    total,
    withOriginalStreet,
    withOriginalDetails,
  })
}

// DELETE - очистить поля оригинальных адресов
export async function DELETE(request: NextRequest) {
  const session = await validateSession(request)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createDirectClient()

  const { error } = await supabase
    .from('zakaz_applications')
    .update({
      street_and_house_original: null,
      address_details_original: null,
    } as never)
    .not('id', 'is', null) // обновляем все записи

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
