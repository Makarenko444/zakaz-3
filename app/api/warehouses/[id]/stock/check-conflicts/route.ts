import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'
import * as XLSX from 'xlsx'

/* eslint-disable @typescript-eslint/no-explicit-any */

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

// POST /api/warehouses/[id]/stock/check-conflicts - проверка конфликтов перед импортом
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params // warehouse id not needed for this check
    const supabase = createDirectClient()

    const session = await validateSession(request)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const columnMappingStr = formData.get('columnMapping') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Файл не предоставлен' }, { status: 400 })
    }

    let columnMapping: ColumnMapping | null = null
    if (columnMappingStr) {
      try {
        columnMapping = JSON.parse(columnMappingStr)
      } catch {
        return NextResponse.json({ error: 'Invalid column mapping' }, { status: 400 })
      }
    }

    if (!columnMapping?.code || !columnMapping?.name) {
      return NextResponse.json({ error: 'Необходимо указать колонки код и название' }, { status: 400 })
    }

    // Читаем файл
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const rawData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet)

    // Собираем коды и названия из файла
    const fileData = new Map<string, string>()
    for (const row of rawData) {
      const code = row[columnMapping.code]
      const name = row[columnMapping.name]
      if (code && name) {
        fileData.set(String(code).trim(), String(name).trim())
      }
    }

    // Получаем существующие материалы с этими кодами
    const codes = Array.from(fileData.keys())
    if (codes.length === 0) {
      return NextResponse.json({ conflicts: [], newMaterials: 0 })
    }

    const { data: existingMaterials } = await (supabase.from as any)('zakaz_materials')
      .select('id, code, name')
      .in('code', codes)

    // Находим конфликты
    const conflicts: Array<{
      code: string
      existingName: string
      newName: string
    }> = []

    const existingCodes = new Set<string>()

    for (const mat of existingMaterials || []) {
      if (mat.code) {
        existingCodes.add(mat.code)
        const newName = fileData.get(mat.code)
        if (newName && newName !== mat.name) {
          conflicts.push({
            code: mat.code,
            existingName: mat.name,
            newName: newName,
          })
        }
      }
    }

    const newMaterials = codes.filter(c => !existingCodes.has(c)).length

    return NextResponse.json({
      conflicts,
      newMaterials,
      existingMaterials: existingCodes.size,
      total: codes.length,
    })
  } catch (error) {
    console.error('[Check Conflicts] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
