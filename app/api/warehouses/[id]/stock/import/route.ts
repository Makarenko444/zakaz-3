import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'
import * as XLSX from 'xlsx'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ColumnMapping {
  code: string // Код материала - обязательный для сопоставления
  quantity: string // Количество
}

interface ExcelRow {
  [key: string]: string | number | undefined
}

// Функция для парсинга числового значения
function parseNumber(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0
  if (typeof value === 'number') return value

  const strValue = String(value)
  let cleaned = strValue.replace(/[\s\u00A0]/g, '')

  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (hasComma) {
    cleaned = cleaned.replace(',', '.')
  }

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

// POST /api/warehouses/[id]/stock/import - импорт остатков для склада
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: warehouseId } = await params
    const supabase = createDirectClient()

    // Проверяем авторизацию
    const session = await validateSession(request)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Проверяем существование склада
    const { data: warehouse, error: whError } = await (supabase.from as any)('zakaz_warehouses')
      .select('id, name')
      .eq('id', warehouseId)
      .single()

    if (whError || !warehouse) {
      return NextResponse.json(
        { error: 'Склад не найден' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const columnMappingStr = formData.get('columnMapping') as string | null
    const noHeadersStr = formData.get('noHeaders') as string | null
    const noHeaders = noHeadersStr === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'Файл не предоставлен' },
        { status: 400 }
      )
    }

    // Парсим маппинг колонок
    let columnMapping: ColumnMapping | null = null
    if (columnMappingStr) {
      try {
        columnMapping = JSON.parse(columnMappingStr)
      } catch (e) {
        console.error('[Stock Import] Failed to parse columnMapping:', e)
      }
    }

    if (!columnMapping?.code) {
      return NextResponse.json(
        { error: 'Необходимо указать колонку с кодом материала' },
        { status: 400 }
      )
    }

    // Читаем файл
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    const colCount = range.e.c - range.s.c + 1

    let rawData: ExcelRow[]

    if (noHeaders) {
      const generatedHeaders = Array.from({ length: colCount }, (_, i) => `Колонка ${i + 1}`)
      rawData = XLSX.utils.sheet_to_json(worksheet, { header: generatedHeaders, range: 0 }) as ExcelRow[]
    } else {
      rawData = XLSX.utils.sheet_to_json(worksheet)
    }

    if (rawData.length === 0) {
      return NextResponse.json(
        { error: 'Файл пустой' },
        { status: 400 }
      )
    }

    // Получаем все материалы с кодами для сопоставления
    const { data: materials } = await (supabase.from as any)('zakaz_materials')
      .select('id, code, name')
      .not('code', 'is', null)

    const materialsByCode = new Map<string, { id: string; name: string }>()
    for (const m of materials || []) {
      if (m.code) {
        materialsByCode.set(m.code.trim(), { id: m.id, name: m.name })
      }
    }

    // Обрабатываем строки
    const stocksToUpsert = []
    const skipped = []
    const errors = []
    const now = new Date().toISOString()

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNumber = noHeaders ? i + 1 : i + 2

      try {
        const code = row[columnMapping.code]
        const quantity = columnMapping.quantity ? row[columnMapping.quantity] : 0

        if (!code) {
          skipped.push({ row: rowNumber, reason: 'Отсутствует код материала' })
          continue
        }

        const codeStr = String(code).trim()
        const material = materialsByCode.get(codeStr)

        if (!material) {
          skipped.push({ row: rowNumber, reason: `Материал с кодом "${codeStr}" не найден в справочнике` })
          continue
        }

        stocksToUpsert.push({
          warehouse_id: warehouseId,
          material_id: material.id,
          quantity: parseNumber(quantity),
          last_import_at: now,
          updated_at: now,
        })
      } catch (error) {
        errors.push({ row: rowNumber, error: String(error) })
      }
    }

    // Удаляем дубликаты (оставляем последний)
    const uniqueStocksMap = new Map()
    for (const stock of stocksToUpsert) {
      uniqueStocksMap.set(stock.material_id, stock)
    }
    const uniqueStocks = Array.from(uniqueStocksMap.values())

    // Вставляем/обновляем остатки
    let processedCount = 0
    const batchSize = 100

    for (let i = 0; i < uniqueStocks.length; i += batchSize) {
      const batch = uniqueStocks.slice(i, i + batchSize)

      const { error: upsertError } = await (supabase.from as any)('zakaz_warehouse_stocks')
        .upsert(batch, {
          onConflict: 'warehouse_id,material_id',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        console.error('[Stock Import] Upsert error:', upsertError)
        errors.push({ row: 0, error: upsertError.message })
      } else {
        processedCount += batch.length
      }
    }

    return NextResponse.json({
      success: true,
      message: `Импорт завершён: обновлено ${processedCount} позиций`,
      stats: {
        total: rawData.length,
        processed: processedCount,
        skipped: skipped.length,
        errors: errors.length,
      },
      details: {
        skipped: skipped.slice(0, 50),
        errors: errors.slice(0, 50),
      },
      warehouse: warehouse.name,
    })
  } catch (error) {
    console.error('[Stock Import] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
