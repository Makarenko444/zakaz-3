import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/session'
import * as XLSX from 'xlsx'

// POST /api/materials/import/preview - предпросмотр Excel файла
export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request)

    // Проверяем права доступа (только админы)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can preview import files' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const noHeadersStr = formData.get('noHeaders') as string | null
    const noHeaders = noHeadersStr === 'true'

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

    // Получаем диапазон данных
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')

    // Конвертируем в JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 }) as unknown[][]

    let headers: string[]
    let dataRows: unknown[][]
    let totalRows: number

    if (noHeaders) {
      // Файл без заголовков - генерируем названия колонок
      const colCount = range.e.c - range.s.c + 1
      headers = Array.from({ length: colCount }, (_, i) => `Колонка ${i + 1}`)
      // Все строки - данные (берём первые 15)
      dataRows = rawData.slice(0, 15)
      totalRows = rawData.length
    } else {
      // Файл с заголовками - первая строка = заголовки
      headers = []
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col })
        const cell = worksheet[cellAddress]
        headers.push(cell ? String(cell.v) : `Колонка ${col + 1}`)
      }
      // Остальные строки - данные (берём первые 15)
      dataRows = rawData.slice(1, 16)
      totalRows = rawData.length - 1
    }

    // Преобразуем в объекты с заголовками
    const preview = dataRows.map((row, index) => {
      // Номер строки в Excel: +1 для Excel-нумерации, +1 если есть заголовок
      const rowNumber = noHeaders ? index + 1 : index + 2
      const obj: Record<string, unknown> = { __rowNumber: rowNumber }
      headers.forEach((header, colIndex) => {
        obj[header] = row[colIndex] !== undefined ? row[colIndex] : ''
      })
      return obj
    })

    return NextResponse.json({
      success: true,
      filename: file.name,
      sheetName: firstSheetName,
      totalRows,
      headers,
      preview,
    })
  } catch (error) {
    console.error('[Materials Import Preview] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
