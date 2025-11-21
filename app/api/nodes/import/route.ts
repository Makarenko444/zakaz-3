import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { logAudit, getClientIP, getUserAgent } from '@/lib/audit-log'
import { validateSession } from '@/lib/session'
import * as XLSX from 'xlsx'

interface ExcelRow {
  ID?: number
  'Код'?: string
  'Адрес'?: string
  'Местоположение'?: string
  'Ком.информация'?: string
  'Статус'?: string
  'Договор'?: string
  'Дата создания'?: string | Date
}

// Функция для парсинга статуса
function parseStatus(status?: string): 'existing' | 'planned' {
  if (!status) return 'existing'
  const normalized = status.toLowerCase().trim()
  if (normalized.includes('проектир')) return 'planned'
  return 'existing'
}

// Функция для парсинга даты из Excel
function parseDate(dateValue: unknown): string | null {
  if (!dateValue) return null

  try {
    // Если это уже Date объект
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0]
    }

    // Если это число Excel (количество дней с 1900-01-01)
    if (typeof dateValue === 'number') {
      const date = XLSX.SSF.parse_date_code(dateValue)
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }

    // Если это строка
    if (typeof dateValue === 'string') {
      // Пробуем распарсить формат DD.MM.YYYY
      const match = dateValue.match(/(\d{2})\.(\d{2})\.(\d{4})/)
      if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`
      }

      // Пробуем стандартный парсинг
      const date = new Date(dateValue)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    }

    return null
  } catch (error) {
    console.error('Error parsing date:', dateValue, error)
    return null
  }
}

// Функция для очистки гиперссылок из кода
function cleanCode(code?: string): string | null {
  if (!code) return null
  // Удаляем все символы кроме букв, цифр, дефиса и подчёркивания
  return code.replace(/[^\wА-Яа-я0-9\-]/g, '').trim()
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createDirectClient()
    const session = await validateSession(request)

    // Проверяем права доступа (только админы могут импортировать)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can import nodes' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
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

    // Подготавливаем данные для вставки
    const nodesToInsert = []
    const skipped = []
    const errors = []

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNumber = i + 2 // +2 потому что в Excel нумерация с 1 и первая строка - заголовок

      try {
        // Очищаем код от гиперссылок
        const code = cleanCode(row['Код'])
        const address = row['Адрес']?.trim()

        // Проверяем обязательные поля
        if (!code) {
          skipped.push({ row: rowNumber, reason: 'Missing code', data: row })
          continue
        }

        if (!address) {
          skipped.push({ row: rowNumber, reason: 'Missing address', data: row })
          continue
        }

        // Формируем объект для вставки (дубликаты будут обработаны через upsert)
        nodesToInsert.push({
          code,
          address,
          location_details: row['Местоположение']?.trim() || null,
          comm_info: row['Ком.информация']?.trim() || null,
          status: parseStatus(row['Статус']),
          contract_link: row['Договор']?.trim() || null,
          node_created_date: parseDate(row['Дата создания']),
          created_by: session.user.id,
        })
      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error)
        errors.push({ row: rowNumber, error: String(error), data: row })
      }
    }

    // Удаляем дубликаты по коду (оставляем последнюю запись для каждого кода)
    const uniqueNodesMap = new Map()
    const duplicates = []

    for (const node of nodesToInsert) {
      if (uniqueNodesMap.has(node.code)) {
        duplicates.push({
          code: node.code,
          reason: 'Duplicate code in Excel file (using last occurrence)',
        })
      }
      uniqueNodesMap.set(node.code, node)
    }

    const uniqueNodesToInsert = Array.from(uniqueNodesMap.values())

    // Вставляем узлы партиями по 100 штук для оптимизации
    // Используем upsert для обновления существующих записей и вставки новых
    const batchSize = 100
    let processedCount = 0
    const insertErrors = []

    for (let i = 0; i < uniqueNodesToInsert.length; i += batchSize) {
      const batch = uniqueNodesToInsert.slice(i, i + batchSize)

      const table = supabase.from('zakaz_nodes') as unknown
      const result = await (table as {
        upsert: (data: unknown, options: unknown) => {
          select: () => Promise<unknown>
        }
      }).upsert(batch, {
        onConflict: 'code',
        ignoreDuplicates: false // Обновляем существующие записи
      }).select()
      const { data, error } = result as { data: unknown[] | null; error: { message: string } | null }

      if (error) {
        console.error(`Error upserting batch ${i / batchSize + 1}:`, error)
        insertErrors.push({
          batch: i / batchSize + 1,
          error: error.message,
          count: batch.length,
        })
      } else {
        const batchCount = data?.length || 0
        processedCount += batchCount
      }
    }

    // Логируем импорт
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.full_name,
      actionType: 'create',
      entityType: 'other',
      description: `Imported/updated ${processedCount} nodes from ${file.name}`,
      newValues: {
        filename: file.name,
        totalRows: rawData.length,
        processed: processedCount,
        duplicates: duplicates.length,
        skipped: skipped.length,
        errors: errors.length + insertErrors.length,
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: `Import completed: ${processedCount} nodes processed (inserted or updated)${duplicates.length > 0 ? `, ${duplicates.length} duplicates merged` : ''}`,
      stats: {
        total: rawData.length,
        processed: processedCount,
        duplicates: duplicates.length,
        skipped: skipped.length,
        errors: errors.length + insertErrors.length,
      },
      details: {
        duplicates: duplicates.length > 0 ? duplicates : undefined,
        skipped: skipped.length > 0 ? skipped : undefined,
        errors: [...errors, ...insertErrors].length > 0 ? [...errors, ...insertErrors] : undefined,
      },
    })
  } catch (error) {
    console.error('Error in POST /api/nodes/import:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
