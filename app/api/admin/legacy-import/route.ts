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

// Создание записи в лог
function log(
  logs: ImportLogEntry[],
  level: ImportLogEntry['level'],
  message: string,
  details?: string
) {
  logs.push({
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const logs: ImportLogEntry[] = []
  const stats: ImportStats = {
    orders: { total: 0, imported: 0, skipped: 0, errors: 0 },
    comments: { total: 0, imported: 0, skipped: 0, errors: 0 },
    files: { total: 0, imported: 0, skipped: 0, errors: 0 },
  }

  try {
    // Проверка авторизации
    const session = await validateSession(request)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    log(logs, 'info', 'Начало импорта', `Пользователь: ${session.user.email}`)

    // Получение файлов из FormData
    const formData = await request.formData()
    const ordersFile = formData.get('orders') as File | null
    const commentsFile = formData.get('comments') as File | null
    const filesFile = formData.get('files') as File | null

    if (!ordersFile) {
      log(logs, 'error', 'Файл orders.tsv не загружен')
      return NextResponse.json({
        success: false,
        stats,
        log: logs,
        duration: Date.now() - startTime,
        error: 'Файл orders.tsv обязателен',
      }, { status: 400 })
    }

    const supabase = createDirectClient()

    // Парсинг файлов
    log(logs, 'info', 'Парсинг файлов...')

    const ordersText = await ordersFile.text()
    const orders = parseTSV<LegacyOrder>(ordersText)
    stats.orders.total = orders.length
    log(logs, 'info', `Найдено заявок: ${orders.length}`)

    let comments: LegacyComment[] = []
    if (commentsFile) {
      const commentsText = await commentsFile.text()
      comments = parseTSV<LegacyComment>(commentsText)
      stats.comments.total = comments.length
      log(logs, 'info', `Найдено комментариев: ${comments.length}`)
    }

    let files: LegacyFile[] = []
    if (filesFile) {
      const filesText = await filesFile.text()
      files = parseTSV<LegacyFile>(filesText)
      stats.files.total = files.length
      log(logs, 'info', `Найдено файлов: ${files.length}`)
    }

    // Получаем существующие legacy_id для проверки дубликатов
    const { data: existingOrders } = await supabase
      .from('zakaz_applications')
      .select('legacy_id')
      .not('legacy_id', 'is', null)

    const existingLegacyIds = new Set(
      (existingOrders || []).map((o: { legacy_id: number | null }) => o.legacy_id?.toString())
    )

    log(logs, 'info', `Существующих импортированных заявок: ${existingLegacyIds.size}`)

    // Маппинг legacy_id -> new_application_id для комментариев и файлов
    const orderIdMapping: Map<string, string> = new Map()

    // ==================== ИМПОРТ ЗАЯВОК ====================
    log(logs, 'info', '=== Импорт заявок ===')

    for (const order of orders) {
      const legacyId = order.id?.trim()

      if (!legacyId) {
        stats.orders.errors++
        log(logs, 'warning', 'Пропущена заявка без ID')
        continue
      }

      // Проверка дубликата
      if (existingLegacyIds.has(legacyId)) {
        stats.orders.skipped++
        log(logs, 'warning', `Заявка #${legacyId} уже импортирована, пропуск`)

        // Получаем ID для маппинга
        const { data: existing } = await supabase
          .from('zakaz_applications')
          .select('id')
          .eq('legacy_id', parseInt(legacyId))
          .single() as { data: { id: string } | null }

        if (existing) {
          orderIdMapping.set(legacyId, existing.id)
        }
        continue
      }

      try {
        // Маппинг stage -> status
        const stageMapping = STAGE_STATUS_MAPPING[order.stage?.trim()] || {
          status: 'new',
          urgency: 'normal',
        }

        // Определение типа клиента и данных
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
            // Игнорируем ошибки парсинга даты
          }
        }

        // Подготовка данных для вставки
        const applicationData = {
          legacy_id: parseInt(legacyId),
          legacy_stage: order.stage?.trim() || null,
          application_number: parseInt(order.number?.trim()) || parseInt(legacyId),
          customer_type: customerType,
          customer_fullname: customerFullname,
          customer_phone: '', // В старой системе нет телефона в основной таблице
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
          log(logs, 'error', `Ошибка импорта заявки #${legacyId}`, error.message)
          continue
        }

        stats.orders.imported++
        orderIdMapping.set(legacyId, inserted!.id)
        log(logs, 'success', `Импортирована заявка #${legacyId} -> ${inserted!.id}`)

      } catch (error) {
        stats.orders.errors++
        log(logs, 'error', `Ошибка обработки заявки #${legacyId}`,
          error instanceof Error ? error.message : 'Unknown error')
      }
    }

    log(logs, 'info', `Заявки: импортировано ${stats.orders.imported}, пропущено ${stats.orders.skipped}, ошибок ${stats.orders.errors}`)

    // ==================== ИМПОРТ КОММЕНТАРИЕВ ====================
    if (comments.length > 0) {
      log(logs, 'info', '=== Импорт комментариев ===')

      // Получаем существующие legacy_id комментариев
      const { data: existingComments } = await supabase
        .from('zakaz_application_comments')
        .select('legacy_id')
        .not('legacy_id', 'is', null)

      const existingCommentLegacyIds = new Set(
        (existingComments || []).map((c: { legacy_id: number | null }) => c.legacy_id?.toString())
      )

      for (const comment of comments) {
        const legacyCid = comment.cid?.trim()
        const legacyNid = comment.nid?.trim()

        if (!legacyCid || !legacyNid) {
          stats.comments.errors++
          log(logs, 'warning', 'Пропущен комментарий без ID')
          continue
        }

        // Проверка дубликата
        if (existingCommentLegacyIds.has(legacyCid)) {
          stats.comments.skipped++
          continue
        }

        // Получаем ID заявки
        const applicationId = orderIdMapping.get(legacyNid)
        if (!applicationId) {
          stats.comments.skipped++
          log(logs, 'warning', `Комментарий #${legacyCid}: заявка #${legacyNid} не найдена`)
          continue
        }

        try {
          // Парсинг даты
          let createdAt: string | null = null
          if (comment.created_at) {
            try {
              const date = new Date(comment.created_at)
              if (!isNaN(date.getTime())) {
                createdAt = date.toISOString()
              }
            } catch {
              // Игнорируем ошибки парсинга даты
            }
          }

          // Формируем текст комментария (subject + comment)
          let commentText = comment.comment?.trim() || ''
          if (comment.subject?.trim()) {
            commentText = `**${comment.subject.trim()}**\n\n${commentText}`
          }

          // Очистка HTML (базовая)
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
            log(logs, 'error', `Ошибка импорта комментария #${legacyCid}`, error.message)
            continue
          }

          stats.comments.imported++

        } catch (error) {
          stats.comments.errors++
          log(logs, 'error', `Ошибка обработки комментария #${legacyCid}`,
            error instanceof Error ? error.message : 'Unknown error')
        }
      }

      log(logs, 'info', `Комментарии: импортировано ${stats.comments.imported}, пропущено ${stats.comments.skipped}, ошибок ${stats.comments.errors}`)
    }

    // ==================== ИМПОРТ ФАЙЛОВ ====================
    if (files.length > 0) {
      log(logs, 'info', '=== Импорт метаданных файлов ===')

      // Получаем существующие legacy_id файлов
      const { data: existingFiles } = await supabase
        .from('zakaz_files')
        .select('legacy_id')
        .not('legacy_id', 'is', null)

      const existingFileLegacyIds = new Set(
        (existingFiles || []).map((f: { legacy_id: number | null }) => f.legacy_id?.toString())
      )

      for (const file of files) {
        const legacyFid = file.fid?.trim()
        const legacyNid = file.nid?.trim()

        if (!legacyFid || !legacyNid) {
          stats.files.errors++
          log(logs, 'warning', 'Пропущен файл без ID')
          continue
        }

        // Проверка дубликата
        if (existingFileLegacyIds.has(legacyFid)) {
          stats.files.skipped++
          continue
        }

        // Получаем ID заявки
        const applicationId = orderIdMapping.get(legacyNid)
        if (!applicationId) {
          stats.files.skipped++
          log(logs, 'warning', `Файл #${legacyFid}: заявка #${legacyNid} не найдена`)
          continue
        }

        try {
          // Парсинг даты
          let uploadedAt: string | null = null
          if (file.uploaded_at) {
            try {
              const date = new Date(file.uploaded_at)
              if (!isNaN(date.getTime())) {
                uploadedAt = date.toISOString()
              }
            } catch {
              // Игнорируем ошибки парсинга даты
            }
          }

          // Определяем MIME тип по расширению
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
            stored_filename: `legacy_${legacyFid}_${filename}`, // Временное имя, потом мигрируем файлы
            file_size: parseInt(file.filesize) || 0,
            mime_type: mimeType,
            uploaded_by: null, // Legacy файлы без автора
            description: file.description?.trim() || null,
            uploaded_at: uploadedAt,
          }

          const { error } = await supabase
            .from('zakaz_files')
            .insert(fileData as never) as { error: { message: string } | null }

          if (error) {
            stats.files.errors++
            log(logs, 'error', `Ошибка импорта файла #${legacyFid}`, error.message)
            continue
          }

          stats.files.imported++

        } catch (error) {
          stats.files.errors++
          log(logs, 'error', `Ошибка обработки файла #${legacyFid}`,
            error instanceof Error ? error.message : 'Unknown error')
        }
      }

      log(logs, 'info', `Файлы: импортировано ${stats.files.imported}, пропущено ${stats.files.skipped}, ошибок ${stats.files.errors}`)
    }

    // Финальный отчёт
    const duration = Date.now() - startTime
    const success = stats.orders.errors === 0 &&
                   stats.comments.errors === 0 &&
                   stats.files.errors === 0

    log(logs, success ? 'success' : 'warning', 'Импорт завершён',
      `Время: ${(duration / 1000).toFixed(2)} сек`)

    return NextResponse.json({
      success,
      stats,
      log: logs,
      duration,
    })

  } catch (error) {
    console.error('Legacy import error:', error)
    log(logs, 'error', 'Критическая ошибка импорта',
      error instanceof Error ? error.message : 'Unknown error')

    return NextResponse.json({
      success: false,
      stats,
      log: logs,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
