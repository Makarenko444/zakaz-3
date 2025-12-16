import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'
import { validateSession } from '@/lib/session'
import * as XLSX from 'xlsx'

interface ColumnMapping {
  code: string
  name: string
  unit: string
  price: string
  quantity: string
}

interface ExcelRow {
  [key: string]: string | number | undefined
}

// Функция для парсинга числового значения
function parseNumber(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0
  if (typeof value === 'number') return value

  // Убираем пробелы и заменяем запятую на точку
  const cleaned = String(value).replace(/\s/g, '').replace(',', '.')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

// Функция для нормализации единицы измерения
function normalizeUnit(unit: unknown): string {
  if (!unit) return 'шт'

  const normalized = String(unit).toLowerCase().trim()

  // Стандартизируем единицы измерения
  if (normalized.includes('шт') || normalized === 'шт.' || normalized === 'штук') return 'шт'
  if (normalized.includes('м') && !normalized.includes('мм')) return 'м'
  if (normalized.includes('мм')) return 'мм'
  if (normalized.includes('уп') || normalized === 'упак' || normalized === 'упаковка') return 'уп'
  if (normalized.includes('кг')) return 'кг'
  if (normalized.includes('л') || normalized === 'литр') return 'л'
  if (normalized.includes('компл') || normalized === 'комплект') return 'компл'
  if (normalized.includes('рул') || normalized === 'рулон') return 'рул'
  if (normalized.includes('бух') || normalized === 'бухта') return 'бухта'

  return String(unit).trim() || 'шт'
}

// Функция для определения категории по названию
function detectCategory(name: string): string | null {
  const lowerName = name.toLowerCase()

  if (lowerName.includes('кабель') || lowerName.includes('витая пара') || lowerName.includes('utp') || lowerName.includes('ftp')) {
    return 'кабель'
  }
  if (lowerName.includes('разъем') || lowerName.includes('разъём') || lowerName.includes('rj45') || lowerName.includes('вилка') || lowerName.includes('розетка') || lowerName.includes('keystone')) {
    return 'разъём'
  }
  if (lowerName.includes('короб') || lowerName.includes('канал') || lowerName.includes('лоток')) {
    return 'короб'
  }
  if (lowerName.includes('саморез') || lowerName.includes('дюбель') || lowerName.includes('скоба') || lowerName.includes('стяжка') || lowerName.includes('хомут') || lowerName.includes('гвоздь')) {
    return 'крепёж'
  }
  if (lowerName.includes('коммутатор') || lowerName.includes('switch') || lowerName.includes('роутер') || lowerName.includes('router') || lowerName.includes('медиаконвертер')) {
    return 'оборудование'
  }
  if (lowerName.includes('sfp') || lowerName.includes('патчкорд') || lowerName.includes('патч-корд') || lowerName.includes('шнур')) {
    return 'оптика'
  }
  if (lowerName.includes('муфта') || lowerName.includes('бокс') || lowerName.includes('шкаф')) {
    return 'монтаж'
  }
  if (lowerName.includes('инструмент') || lowerName.includes('отвертка') || lowerName.includes('кримпер') || lowerName.includes('тестер')) {
    return 'инструмент'
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const session = await validateSession(request)

    // Проверяем права доступа (только админы могут импортировать)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can import materials' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const columnMappingStr = formData.get('columnMapping') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Парсим маппинг колонок (если передан)
    let columnMapping: ColumnMapping | null = null
    if (columnMappingStr) {
      try {
        columnMapping = JSON.parse(columnMappingStr)
      } catch (e) {
        console.error('[Materials Import] Failed to parse columnMapping:', e)
      }
    }

    // Проверяем расширение файла
    const filename = file.name.toLowerCase()
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Only Excel files (.xlsx, .xls) are allowed' },
        { status: 400 }
      )
    }

    // Читаем файл
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Берём первый лист
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Конвертируем в JSON
    const rawData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)

    if (rawData.length === 0) {
      return NextResponse.json(
        { error: 'Excel file is empty' },
        { status: 400 }
      )
    }

    // Логируем первую строку для отладки
    console.log('[Materials Import] First row columns:', Object.keys(rawData[0]))
    console.log('[Materials Import] Column mapping:', columnMapping)

    // Подготавливаем данные для вставки
    const materialsToInsert = []
    const skipped = []
    const errors = []
    const now = new Date().toISOString()

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNumber = i + 2 // +2 потому что в Excel нумерация с 1 и первая строка - заголовок

      try {
        // Если есть маппинг колонок - используем его
        let code: unknown = null
        let name: unknown = null
        let unit: unknown = null
        let price: unknown = null
        let quantity: unknown = null

        if (columnMapping) {
          if (columnMapping.code) code = row[columnMapping.code]
          if (columnMapping.name) name = row[columnMapping.name]
          if (columnMapping.unit) unit = row[columnMapping.unit]
          if (columnMapping.price) price = row[columnMapping.price]
          if (columnMapping.quantity) quantity = row[columnMapping.quantity]
        } else {
          // Автоматическое определение колонок (fallback)
          for (const [key, value] of Object.entries(row)) {
            const lowerKey = key.toLowerCase()
            if (!code && (lowerKey.includes('код') || lowerKey === 'code' || lowerKey.includes('артикул'))) code = value
            if (!name && (lowerKey.includes('наименование') || lowerKey.includes('название') || lowerKey === 'name')) name = value
            if (!unit && (lowerKey.includes('ед.изм') || lowerKey.includes('ед. изм') || lowerKey === 'unit')) unit = value
            if (!price && (lowerKey.includes('цена') || lowerKey === 'price')) price = value
            if (!quantity && (lowerKey.includes('остаток') || lowerKey.includes('количество') || lowerKey === 'qty')) quantity = value
          }
        }

        // Проверяем обязательные поля
        if (!name) {
          skipped.push({ row: rowNumber, reason: 'Отсутствует наименование' })
          continue
        }

        const nameStr = String(name).trim()
        if (!nameStr) {
          skipped.push({ row: rowNumber, reason: 'Пустое наименование' })
          continue
        }

        // Формируем объект для вставки
        materialsToInsert.push({
          code: code ? String(code).trim() : null,
          name: nameStr,
          unit: normalizeUnit(unit),
          price: parseNumber(price),
          stock_quantity: parseNumber(quantity),
          category: detectCategory(nameStr),
          is_active: true,
          last_import_at: now,
        })
      } catch (error) {
        console.error(`[Materials Import] Error processing row ${rowNumber}:`, error)
        errors.push({ row: rowNumber, error: String(error) })
      }
    }

    // Удаляем дубликаты по коду (оставляем последнюю запись)
    const uniqueMaterialsMap = new Map()
    const duplicates = []

    for (const material of materialsToInsert) {
      const key = material.code || material.name
      if (uniqueMaterialsMap.has(key)) {
        duplicates.push({
          key,
          reason: 'Дубликат в файле (используется последняя запись)',
        })
      }
      uniqueMaterialsMap.set(key, material)
    }

    const uniqueMaterialsToInsert = Array.from(uniqueMaterialsMap.values())

    // Вставляем материалы партиями по 100 штук
    const batchSize = 100
    let processedCount = 0
    let insertedCount = 0
    let updatedCount = 0
    const insertErrors = []

    for (let i = 0; i < uniqueMaterialsToInsert.length; i += batchSize) {
      const batch = uniqueMaterialsToInsert.slice(i, i + batchSize)

      // Разделяем на материалы с кодом и без кода
      const withCode = batch.filter(m => m.code)
      const withoutCode = batch.filter(m => !m.code)

      // Материалы с кодом - upsert по коду
      if (withCode.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from as any)('zakaz_materials')
          .upsert(withCode, {
            onConflict: 'code',
            ignoreDuplicates: false,
          })
          .select('id')

        if (error) {
          console.error(`[Materials Import] Error upserting batch with code:`, error)
          insertErrors.push({
            batch: Math.floor(i / batchSize) + 1,
            error: error.message,
            count: withCode.length,
          })
        } else {
          processedCount += data?.length || 0
        }
      }

      // Материалы без кода - проверяем по названию и обновляем или вставляем
      for (const material of withoutCode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from as any)('zakaz_materials')
          .select('id')
          .eq('name', material.name)
          .single()

        if (existing) {
          // Обновляем существующий
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from as any)('zakaz_materials')
            .update({
              unit: material.unit,
              price: material.price,
              stock_quantity: material.stock_quantity,
              category: material.category,
              last_import_at: material.last_import_at,
            })
            .eq('id', existing.id)

          if (!error) {
            processedCount++
            updatedCount++
          }
        } else {
          // Вставляем новый
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from as any)('zakaz_materials')
            .insert(material)

          if (!error) {
            processedCount++
            insertedCount++
          }
        }
      }
    }

    // Логируем импорт
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.full_name,
      actionType: 'create',
      entityType: 'other',
      description: `Импортировано ${processedCount} материалов из ${file.name}`,
      newValues: {
        filename: file.name,
        totalRows: rawData.length,
        processed: processedCount,
        inserted: insertedCount,
        updated: updatedCount,
        duplicates: duplicates.length,
        skipped: skipped.length,
        errors: errors.length + insertErrors.length,
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: `Импорт завершён: обработано ${processedCount} материалов`,
      stats: {
        total: rawData.length,
        processed: processedCount,
        inserted: insertedCount,
        updated: updatedCount,
        duplicates: duplicates.length,
        skipped: skipped.length,
        errors: errors.length + insertErrors.length,
      },
      details: {
        duplicates: duplicates.length > 0 ? duplicates.slice(0, 10) : undefined,
        skipped: skipped.length > 0 ? skipped.slice(0, 10) : undefined,
        errors: [...errors, ...insertErrors].length > 0 ? [...errors, ...insertErrors].slice(0, 10) : undefined,
      },
    })
  } catch (error) {
    console.error('[Materials Import] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
