import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'
import * as XLSX from 'xlsx'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ColumnMapping {
  code: string      // Код материала - обязательный
  name: string      // Наименование - обязательный
  unit: string      // Единица измерения
  price: string     // Цена
  quantity: string  // Количество/остаток - обязательный
}

interface ImportOptions {
  updateNames: boolean  // Обновлять названия существующих материалов
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

// POST /api/warehouses/[id]/stock/import - импорт материалов и остатков для склада
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
    const optionsStr = formData.get('options') as string | null
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

    // Парсим опции импорта
    let options: ImportOptions = { updateNames: true }
    if (optionsStr) {
      try {
        options = JSON.parse(optionsStr)
      } catch (e) {
        console.error('[Stock Import] Failed to parse options:', e)
      }
    }

    if (!columnMapping?.code || !columnMapping?.name || !columnMapping?.quantity) {
      return NextResponse.json(
        { error: 'Необходимо указать колонки: код, наименование и количество' },
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

    // Получаем все существующие материалы по кодам
    const { data: existingMaterials } = await (supabase.from as any)('zakaz_materials')
      .select('id, code, name')
      .not('code', 'is', null)

    const materialsByCode = new Map<string, { id: string; name: string }>()
    for (const m of existingMaterials || []) {
      if (m.code) {
        materialsByCode.set(m.code.trim(), { id: m.id, name: m.name })
      }
    }

    // Обрабатываем строки - собираем материалы для upsert
    const materialsToUpsert: Array<{
      code: string
      name: string
      unit: string
      price: number
      last_import_at: string
    }> = []
    const skipped: Array<{ row: number; reason: string }> = []
    const errors: Array<{ row: number; error: string }> = []
    const now = new Date().toISOString()

    // Для отслеживания дубликатов кодов в файле
    const seenCodes = new Map<string, number>()

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNumber = noHeaders ? i + 1 : i + 2

      try {
        const code = row[columnMapping.code]
        const name = row[columnMapping.name]
        const unit = columnMapping.unit ? row[columnMapping.unit] : null
        const price = columnMapping.price ? row[columnMapping.price] : null
        const quantity = row[columnMapping.quantity]

        // Валидация обязательных полей
        if (!code) {
          skipped.push({ row: rowNumber, reason: 'Отсутствует код материала' })
          continue
        }

        if (!name) {
          skipped.push({ row: rowNumber, reason: 'Отсутствует наименование' })
          continue
        }

        const codeStr = String(code).trim()
        const nameStr = String(name).trim()

        if (!codeStr || !nameStr) {
          skipped.push({ row: rowNumber, reason: 'Пустой код или наименование' })
          continue
        }

        // Проверяем дубликаты кодов в файле
        if (seenCodes.has(codeStr)) {
          // Обновляем данные последней строкой с этим кодом
        }
        seenCodes.set(codeStr, rowNumber)

        materialsToUpsert.push({
          code: codeStr,
          name: nameStr,
          unit: unit ? String(unit).trim() : 'шт',
          price: parseNumber(price),
          last_import_at: now,
        })
      } catch (error) {
        errors.push({ row: rowNumber, error: String(error) })
      }
    }

    // Удаляем дубликаты кодов (оставляем последние)
    const uniqueMaterialsMap = new Map<string, typeof materialsToUpsert[0]>()
    for (const mat of materialsToUpsert) {
      uniqueMaterialsMap.set(mat.code, mat)
    }
    const uniqueMaterials = Array.from(uniqueMaterialsMap.values())

    // Разделяем на новые и существующие материалы
    const newMaterials = uniqueMaterials.filter(m => !materialsByCode.has(m.code))
    const existingMaterialsToUpdate = uniqueMaterials.filter(m => materialsByCode.has(m.code))

    let insertedMaterials = 0
    let updatedMaterials = 0
    const batchSize = 100

    // Вставляем новые материалы (со всеми полями)
    for (let i = 0; i < newMaterials.length; i += batchSize) {
      const batch = newMaterials.slice(i, i + batchSize)

      const { data: insertedData, error: insertError } = await (supabase.from as any)('zakaz_materials')
        .insert(batch)
        .select('id, code')

      if (insertError) {
        console.error('[Stock Import] Material insert error:', insertError)
        errors.push({ row: 0, error: `Ошибка добавления материалов: ${insertError.message}` })
      } else if (insertedData) {
        for (const mat of insertedData) {
          materialsByCode.set(mat.code, { id: mat.id, name: '' })
          insertedMaterials++
        }
      }
    }

    // Обновляем существующие материалы
    for (const mat of existingMaterialsToUpdate) {
      const existing = materialsByCode.get(mat.code)
      if (!existing) continue

      // Формируем данные для обновления
      const updateData: Record<string, unknown> = {
        unit: mat.unit,
        price: mat.price,
        last_import_at: mat.last_import_at,
      }

      // Обновляем название только если опция включена
      if (options.updateNames) {
        updateData.name = mat.name
      }

      const { error: updateError } = await (supabase.from as any)('zakaz_materials')
        .update(updateData)
        .eq('id', existing.id)

      if (updateError) {
        console.error('[Stock Import] Material update error:', updateError)
        errors.push({ row: 0, error: `Ошибка обновления материала ${mat.code}: ${updateError.message}` })
      } else {
        updatedMaterials++
      }
    }

    // Теперь создаем записи остатков
    const stocksToUpsert: Array<{
      warehouse_id: string
      material_id: string
      quantity: number
      last_import_at: string
    }> = []

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNumber = noHeaders ? i + 1 : i + 2

      try {
        const code = row[columnMapping.code]
        const quantity = row[columnMapping.quantity]

        if (!code) continue

        const codeStr = String(code).trim()
        const material = materialsByCode.get(codeStr)

        if (!material) {
          // Материал не был создан (ошибка?)
          continue
        }

        stocksToUpsert.push({
          warehouse_id: warehouseId,
          material_id: material.id,
          quantity: parseNumber(quantity),
          last_import_at: now,
        })
      } catch (error) {
        errors.push({ row: rowNumber, error: String(error) })
      }
    }

    // Удаляем дубликаты остатков (оставляем последний)
    const uniqueStocksMap = new Map<string, typeof stocksToUpsert[0]>()
    for (const stock of stocksToUpsert) {
      uniqueStocksMap.set(stock.material_id, stock)
    }
    const uniqueStocks = Array.from(uniqueStocksMap.values())

    // Upsert остатков
    let processedStocks = 0

    for (let i = 0; i < uniqueStocks.length; i += batchSize) {
      const batch = uniqueStocks.slice(i, i + batchSize)

      const { error: stockError } = await (supabase.from as any)('zakaz_warehouse_stocks')
        .upsert(batch, {
          onConflict: 'warehouse_id,material_id',
          ignoreDuplicates: false,
        })

      if (stockError) {
        console.error('[Stock Import] Stock upsert error:', stockError)
        errors.push({ row: 0, error: `Ошибка сохранения остатков: ${stockError.message}` })
      } else {
        processedStocks += batch.length
      }
    }

    return NextResponse.json({
      success: true,
      message: `Импорт завершён: добавлено ${insertedMaterials} новых материалов, обновлено ${updatedMaterials}, остатков: ${processedStocks}`,
      stats: {
        total: rawData.length,
        processed: uniqueMaterials.length,
        inserted: insertedMaterials,
        updated: updatedMaterials,
        duplicates: materialsToUpsert.length - uniqueMaterials.length,
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
