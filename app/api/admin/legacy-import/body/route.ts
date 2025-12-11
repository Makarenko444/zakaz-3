import { NextRequest, NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { validateSession } from '@/lib/session'

// Типы
interface ImportLogEntry {
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  details?: string
}

interface ImportStats {
  total: number
  updated: number
  skipped: number
  errors: number
}

interface LegacyBody {
  zakaz_nid: string
  zakaz_number: string
  zakaz_created_at: string
  node_vid: string
  revision_changed_at: string
  body: string
  teaser: string
  revision_log: string
}

// Парсинг TSV
function parseTSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split('\t').map(h => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t')
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || ''
    })
    rows.push(row)
  }

  return rows
}

// Очистка HTML и экранированных символов
function cleanBody(text: string): string {
  if (!text) return ''

  return text
    // Убираем литеральные \n и заменяем на реальные переносы строк
    .replace(/\\n/g, '\n')
    // Убираем HTML теги
    .replace(/<[^>]*>/g, '')
    // Декодируем HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Убираем лишние пробелы
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request)

    // Только админы могут импортировать
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const bodyFile = formData.get('body') as File | null
    const recordLimit = parseInt(formData.get('recordLimit') as string) || 0
    const batchSize = parseInt(formData.get('batchSize') as string) || 50

    if (!bodyFile) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Создаём streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const supabase = createDirectClient()
        const logs: ImportLogEntry[] = []
        const stats: ImportStats = {
          total: 0,
          updated: 0,
          skipped: 0,
          errors: 0
        }

        // Функция отправки прогресса
        function sendProgress(phase: string, current: number, total: number, log?: ImportLogEntry) {
          if (log) {
            logs.push(log)
          }
          const data = {
            phase,
            current,
            total,
            log,
            stats,
            done: phase === 'done' || phase === 'error'
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        // Функция логирования
        function log(level: ImportLogEntry['level'], message: string, details?: string) {
          const entry: ImportLogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            details
          }
          sendProgress('body', stats.updated + stats.skipped + stats.errors, stats.total, entry)
        }

        try {
          // Парсим файл
          const text = await bodyFile.text()
          const rows = parseTSV(text) as unknown as LegacyBody[]

          stats.total = recordLimit > 0 ? Math.min(rows.length, recordLimit) : rows.length

          log('info', `Начинаем импорт содержимого заявок`, `Всего записей: ${stats.total}`)

          // Получаем маппинг legacy_id -> id для заявок
          const { data: applications, error: appError } = await supabase
            .from('zakaz_applications')
            .select('id, legacy_id, application_number')
            .not('legacy_id', 'is', null)

          if (appError) {
            throw new Error(`Ошибка получения заявок: ${appError.message}`)
          }

          // Создаём маппинг legacy_id -> {id, application_number}
          const legacyMap = new Map<number, { id: string; application_number: number }>()
          for (const app of applications || []) {
            if (app.legacy_id) {
              legacyMap.set(app.legacy_id, { id: app.id, application_number: app.application_number })
            }
          }

          log('info', `Найдено ${legacyMap.size} заявок с legacy_id`)

          // Обрабатываем записи батчами
          const recordsToProcess = recordLimit > 0 ? rows.slice(0, recordLimit) : rows

          for (let i = 0; i < recordsToProcess.length; i += batchSize) {
            const batch = recordsToProcess.slice(i, i + batchSize)

            for (const row of batch) {
              const legacyId = parseInt(row.zakaz_nid)
              const body = cleanBody(row.body)

              // Пропускаем записи без body
              if (!body) {
                stats.skipped++
                continue
              }

              // Ищем заявку по legacy_id
              const appInfo = legacyMap.get(legacyId)
              if (!appInfo) {
                stats.skipped++
                log('warning', `Заявка с legacy_id=${legacyId} не найдена`, `zakaz_number: ${row.zakaz_number}`)
                continue
              }

              // Обновляем заявку
              const { error: updateError } = await supabase
                .from('zakaz_applications')
                .update({ legacy_body: body })
                .eq('id', appInfo.id)

              if (updateError) {
                stats.errors++
                log('error', `Ошибка обновления заявки #${appInfo.application_number}`, updateError.message)
              } else {
                stats.updated++
              }
            }

            // Отправляем прогресс после каждого батча
            sendProgress('body', stats.updated + stats.skipped + stats.errors, stats.total)
          }

          // Финальный отчёт
          log('success', 'Импорт завершён',
            `Обновлено: ${stats.updated}, пропущено: ${stats.skipped}, ошибок: ${stats.errors}`)

          sendProgress('done', stats.total, stats.total)

        } catch (error) {
          log('error', 'Критическая ошибка импорта', error instanceof Error ? error.message : 'Unknown error')
          sendProgress('error', 0, 0)
        }

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Error in POST /api/admin/legacy-import/body:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - получить статистику по legacy_body
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession(request)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createDirectClient()

    // Считаем заявки с legacy_body
    const { count: withBody } = await supabase
      .from('zakaz_applications')
      .select('*', { count: 'exact', head: true })
      .not('legacy_body', 'is', null)

    // Считаем все legacy заявки
    const { count: totalLegacy } = await supabase
      .from('zakaz_applications')
      .select('*', { count: 'exact', head: true })
      .not('legacy_id', 'is', null)

    return NextResponse.json({
      withBody: withBody || 0,
      totalLegacy: totalLegacy || 0
    })

  } catch (error) {
    console.error('Error in GET /api/admin/legacy-import/body:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
