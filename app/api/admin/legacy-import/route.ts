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
  orders: { total: number; imported: number; skipped: number; errors: number }
  comments: { total: number; imported: number; skipped: number; errors: number }
  files: { total: number; imported: number; skipped: number; errors: number }
}

interface LegacyOrder {
  id: string
  number: string
  created_at: string
  type: string
  client_fio: string
  company: string
  address: string
  status: string
  stage: string
}

interface LegacyComment {
  nid: string
  cid: string
  created_at: string
  author: string
  subject: string
  comment: string
}

interface LegacyFile {
  nid: string
  fid: string
  filename: string
  filepath: string
  filesize: string
  uploaded_at: string
  description: string
}

// Маппинг stage -> status
const STAGE_STATUS_MAPPING: Record<string, { status: string; urgency: string }> = {
  '1. Новая заявка': { status: 'new', urgency: 'normal' },
  '1.1. Собираем группу': { status: 'no_tech', urgency: 'normal' },
  '1.2. Аварийная заявка': { status: 'new', urgency: 'critical' },
  '1.3. Заказчик думает': { status: 'thinking', urgency: 'normal' },
  '1.4. Потенциальный клиент': { status: 'thinking', urgency: 'normal' },
  '1.5. Переоформление договора': { status: 'contract', urgency: 'normal' },
  '2. Расчет стоимости': { status: 'estimation', urgency: 'normal' },
  '2.1. Расчет выполнен': { status: 'estimation', urgency: 'normal' },
  '3. Заключение договора': { status: 'contract', urgency: 'normal' },
  '4. Ждем оплату': { status: 'contract', urgency: 'normal' },
  '5. Проектирование': { status: 'design', urgency: 'normal' },
  '5.1. Согласование': { status: 'approval', urgency: 'normal' },
  '6. Очередь на монтаж': { status: 'queue_install', urgency: 'normal' },
  '7. Монтаж': { status: 'install', urgency: 'normal' },
  '8. Пусконаладка': { status: 'install', urgency: 'normal' },
  '9. Выполнена': { status: 'installed', urgency: 'normal' },
  '10. Отказ': { status: 'rejected', urgency: 'normal' },
  '11. Нет техн. возможности': { status: 'no_tech', urgency: 'normal' },
  '12. Дубль заявки': { status: 'rejected', urgency: 'normal' },
}

// Маппинг type -> service_type
function mapServiceType(type: string): string {
  const normalizedType = type?.toLowerCase().trim() || ''
  if (normalizedType.includes('домашн') || normalizedType.includes('квартир')) {
    return 'apartment'
  }
  if (normalizedType.includes('офис')) {
    return 'office'
  }
  if (normalizedType.includes('скс')) {
    return 'scs'
  }
  return 'apartment' // default
}

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

// Streaming response для прогресса
export async function POST(request: NextRequest) {
  // Проверка авторизации
  const session = await validateSession(request)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Получение файлов из FormData
  const formData = await request.formData()
  const ordersFile = formData.get('orders') as File | null
  const commentsFile = formData.get('comments') as File | null
  const filesFile = formData.get('files') as File | null
  const batchSize = parseInt(formData.get('batchSize') as string) || 50

  if (!ordersFile) {
    return NextResponse.json({ error: 'Файл orders.tsv обязателен' }, { status: 400 })
  }

  // Парсинг файлов заранее
  const ordersText = await ordersFile.text()
  const orders = parseTSV<LegacyOrder>(ordersText)

  let comments: LegacyComment[] = []
  if (commentsFile) {
    const commentsText = await commentsFile.text()
    comments = parseTSV<LegacyComment>(commentsText)
  }

  let files: LegacyFile[] = []
  if (filesFile) {
    const filesText = await filesFile.text()
    files = parseTSV<LegacyFile>(filesText)
  }

  // Создаём streaming response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now()
      const logs: ImportLogEntry[] = []
      const stats: ImportStats = {
        orders: { total: orders.length, imported: 0, skipped: 0, errors: 0 },
        comments: { total: comments.length, imported: 0, skipped: 0, errors: 0 },
        files: { total: files.length, imported: 0, skipped: 0, errors: 0 },
      }

      // Функция отправки прогресса
      function sendProgress(data: {
        phase: string
        current: number
        total: number
        log?: ImportLogEntry
        stats?: ImportStats
        done?: boolean
      }) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Функция логирования
      function log(level: ImportLogEntry['level'], message: string, details?: string) {
        const entry: ImportLogEntry = {
          timestamp: new Date().toISOString(),
          level,
          message,
          details,
        }
        logs.push(entry)
        return entry
      }

      try {
        const supabase = createDirectClient()

        sendProgress({
          phase: 'init',
          current: 0,
          total: orders.length + comments.length + files.length,
          log: log('info', `Начало импорта. Пользователь: ${session.user.email}`),
        })

        sendProgress({
          phase: 'init',
          current: 0,
          total: orders.length + comments.length + files.length,
          log: log('info', `Найдено: заявок ${orders.length}, комментариев ${comments.length}, файлов ${files.length}`),
        })

        // Получаем существующие legacy_id
        const { data: existingOrders } = await supabase
          .from('zakaz_applications')
          .select('legacy_id')
          .not('legacy_id', 'is', null)

        const existingLegacyIds = new Set(
          (existingOrders || []).map((o: { legacy_id: number | null }) => o.legacy_id?.toString())
        )

        sendProgress({
          phase: 'init',
          current: 0,
          total: orders.length,
          log: log('info', `Существующих импортированных заявок: ${existingLegacyIds.size}`),
        })

        // Маппинг legacy_id -> new_application_id
        const orderIdMapping: Map<string, string> = new Map()

        // ==================== ИМПОРТ ЗАЯВОК ====================
        sendProgress({
          phase: 'orders',
          current: 0,
          total: orders.length,
          log: log('info', '=== Импорт заявок ==='),
        })

        for (let i = 0; i < orders.length; i++) {
          const order = orders[i]
          const legacyId = order.id?.trim()

          if (!legacyId) {
            stats.orders.errors++
            continue
          }

          // Проверка дубликата
          if (existingLegacyIds.has(legacyId)) {
            stats.orders.skipped++

            // Получаем ID для маппинга
            const { data: existing } = await supabase
              .from('zakaz_applications')
              .select('id')
              .eq('legacy_id', parseInt(legacyId))
              .single() as { data: { id: string } | null }

            if (existing) {
              orderIdMapping.set(legacyId, existing.id)
            }
          } else {
            try {
              // Маппинг stage -> status
              const stageMapping = STAGE_STATUS_MAPPING[order.stage?.trim()] || {
                status: 'new',
                urgency: 'normal',
              }

              // Определение типа клиента
              const hasCompany = order.company?.trim()
              const customerType = hasCompany ? 'business' : 'individual'
              const customerFullname = hasCompany
                ? order.company.trim()
                : order.client_fio?.trim() || 'Не указано'
              const contactPerson = hasCompany ? order.client_fio?.trim() || null : null

              // Парсинг даты
              let createdAt: string | null = null
              if (order.created_at) {
                try {
                  const date = new Date(order.created_at)
                  if (!isNaN(date.getTime())) {
                    createdAt = date.toISOString()
                  }
                } catch {
                  // ignore
                }
              }

              const applicationData = {
                legacy_id: parseInt(legacyId),
                legacy_stage: order.stage?.trim() || null,
                application_number: parseInt(order.number?.trim()) || parseInt(legacyId),
                customer_type: customerType,
                customer_fullname: customerFullname,
                customer_phone: '',
                contact_person: contactPerson,
                service_type: mapServiceType(order.type),
                status: stageMapping.status,
                urgency: stageMapping.urgency,
                street_and_house: order.address?.trim() || null,
                address_match_status: 'unmatched',
                created_at: createdAt,
              }

              const { data: inserted, error } = await supabase
                .from('zakaz_applications')
                .insert(applicationData as never)
                .select('id')
                .single() as { data: { id: string } | null; error: { message: string } | null }

              if (error) {
                stats.orders.errors++
                if (i % 100 === 0 || stats.orders.errors <= 5) {
                  sendProgress({
                    phase: 'orders',
                    current: i + 1,
                    total: orders.length,
                    log: log('error', `Ошибка заявки #${legacyId}`, error.message),
                  })
                }
              } else {
                stats.orders.imported++
                orderIdMapping.set(legacyId, inserted!.id)
              }
            } catch (error) {
              stats.orders.errors++
            }
          }

          // Отправляем прогресс каждые batchSize записей
          if ((i + 1) % batchSize === 0 || i === orders.length - 1) {
            sendProgress({
              phase: 'orders',
              current: i + 1,
              total: orders.length,
              stats: { ...stats },
              log: log('info', `Заявки: обработано ${i + 1}/${orders.length}`),
            })
          }
        }

        sendProgress({
          phase: 'orders',
          current: orders.length,
          total: orders.length,
          stats: { ...stats },
          log: log('success', `Заявки завершены: импортировано ${stats.orders.imported}, пропущено ${stats.orders.skipped}, ошибок ${stats.orders.errors}`),
        })

        // ==================== ИМПОРТ КОММЕНТАРИЕВ ====================
        if (comments.length > 0) {
          sendProgress({
            phase: 'comments',
            current: 0,
            total: comments.length,
            log: log('info', '=== Импорт комментариев ==='),
          })

          // Получаем существующие legacy_id комментариев
          const { data: existingComments } = await supabase
            .from('zakaz_application_comments')
            .select('legacy_id')
            .not('legacy_id', 'is', null)

          const existingCommentLegacyIds = new Set(
            (existingComments || []).map((c: { legacy_id: number | null }) => c.legacy_id?.toString())
          )

          for (let i = 0; i < comments.length; i++) {
            const comment = comments[i]
            const legacyCid = comment.cid?.trim()
            const legacyNid = comment.nid?.trim()

            if (!legacyCid || !legacyNid) {
              stats.comments.errors++
              continue
            }

            if (existingCommentLegacyIds.has(legacyCid)) {
              stats.comments.skipped++
              continue
            }

            const applicationId = orderIdMapping.get(legacyNid)
            if (!applicationId) {
              stats.comments.skipped++
              continue
            }

            try {
              let createdAt: string | null = null
              if (comment.created_at) {
                try {
                  const date = new Date(comment.created_at)
                  if (!isNaN(date.getTime())) {
                    createdAt = date.toISOString()
                  }
                } catch {
                  // ignore
                }
              }

              let commentText = comment.comment?.trim() || ''
              if (comment.subject?.trim()) {
                commentText = `**${comment.subject.trim()}**\n\n${commentText}`
              }

              // Очистка HTML
              commentText = commentText
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<p>/gi, '')
                .replace(/<\/p>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .trim()

              if (!commentText) {
                stats.comments.skipped++
                continue
              }

              const commentData = {
                legacy_id: parseInt(legacyCid),
                application_id: applicationId,
                user_id: null,
                user_name: comment.author?.trim() || 'Система',
                user_email: null,
                comment: commentText,
                created_at: createdAt,
              }

              const { error } = await supabase
                .from('zakaz_application_comments')
                .insert(commentData as never) as { error: { message: string } | null }

              if (error) {
                stats.comments.errors++
              } else {
                stats.comments.imported++
              }
            } catch {
              stats.comments.errors++
            }

            // Прогресс каждые batchSize записей
            if ((i + 1) % batchSize === 0 || i === comments.length - 1) {
              sendProgress({
                phase: 'comments',
                current: i + 1,
                total: comments.length,
                stats: { ...stats },
                log: log('info', `Комментарии: обработано ${i + 1}/${comments.length}`),
              })
            }
          }

          sendProgress({
            phase: 'comments',
            current: comments.length,
            total: comments.length,
            stats: { ...stats },
            log: log('success', `Комментарии завершены: импортировано ${stats.comments.imported}, пропущено ${stats.comments.skipped}, ошибок ${stats.comments.errors}`),
          })
        }

        // ==================== ИМПОРТ ФАЙЛОВ ====================
        if (files.length > 0) {
          sendProgress({
            phase: 'files',
            current: 0,
            total: files.length,
            log: log('info', '=== Импорт метаданных файлов ==='),
          })

          const { data: existingFiles } = await supabase
            .from('zakaz_files')
            .select('legacy_id')
            .not('legacy_id', 'is', null)

          const existingFileLegacyIds = new Set(
            (existingFiles || []).map((f: { legacy_id: number | null }) => f.legacy_id?.toString())
          )

          for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const legacyFid = file.fid?.trim()
            const legacyNid = file.nid?.trim()

            if (!legacyFid || !legacyNid) {
              stats.files.errors++
              continue
            }

            if (existingFileLegacyIds.has(legacyFid)) {
              stats.files.skipped++
              continue
            }

            const applicationId = orderIdMapping.get(legacyNid)
            if (!applicationId) {
              stats.files.skipped++
              continue
            }

            try {
              let uploadedAt: string | null = null
              if (file.uploaded_at) {
                try {
                  const date = new Date(file.uploaded_at)
                  if (!isNaN(date.getTime())) {
                    uploadedAt = date.toISOString()
                  }
                } catch {
                  // ignore
                }
              }

              const filename = file.filename?.trim() || 'unknown'
              const ext = filename.split('.').pop()?.toLowerCase() || ''
              const mimeTypes: Record<string, string> = {
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                png: 'image/png',
                gif: 'image/gif',
                pdf: 'application/pdf',
                doc: 'application/msword',
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                xls: 'application/vnd.ms-excel',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                txt: 'text/plain',
              }
              const mimeType = mimeTypes[ext] || 'application/octet-stream'

              const fileData = {
                legacy_id: parseInt(legacyFid),
                legacy_path: file.filepath?.trim() || null,
                application_id: applicationId,
                comment_id: null,
                original_filename: filename,
                stored_filename: `legacy_${legacyFid}_${filename}`,
                file_size: parseInt(file.filesize) || 0,
                mime_type: mimeType,
                uploaded_by: null,
                description: file.description?.trim() || null,
                uploaded_at: uploadedAt,
              }

              const { error } = await supabase
                .from('zakaz_files')
                .insert(fileData as never) as { error: { message: string } | null }

              if (error) {
                stats.files.errors++
              } else {
                stats.files.imported++
              }
            } catch {
              stats.files.errors++
            }

            // Прогресс каждые batchSize записей
            if ((i + 1) % batchSize === 0 || i === files.length - 1) {
              sendProgress({
                phase: 'files',
                current: i + 1,
                total: files.length,
                stats: { ...stats },
                log: log('info', `Файлы: обработано ${i + 1}/${files.length}`),
              })
            }
          }

          sendProgress({
            phase: 'files',
            current: files.length,
            total: files.length,
            stats: { ...stats },
            log: log('success', `Файлы завершены: импортировано ${stats.files.imported}, пропущено ${stats.files.skipped}, ошибок ${stats.files.errors}`),
          })
        }

        // Финал
        const duration = Date.now() - startTime
        const success = stats.orders.errors === 0 &&
                       stats.comments.errors === 0 &&
                       stats.files.errors === 0

        sendProgress({
          phase: 'done',
          current: 1,
          total: 1,
          stats: { ...stats },
          log: log(success ? 'success' : 'warning', `Импорт завершён за ${(duration / 1000).toFixed(1)} сек`),
          done: true,
        })

      } catch (error) {
        sendProgress({
          phase: 'error',
          current: 0,
          total: 0,
          log: {
            timestamp: new Date().toISOString(),
            level: 'error',
            message: 'Критическая ошибка',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          done: true,
        })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
