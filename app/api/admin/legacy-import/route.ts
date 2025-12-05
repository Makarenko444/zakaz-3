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
  users: { total: number; imported: number; skipped: number; errors: number }
}

// Новая структура данных из Drupal
interface LegacyOrder {
  // Системные поля
  nid: string
  vid: string
  node_type: string
  node_created_at: string
  node_changed_at: string
  node_uid: string
  node_status: string
  // Поля заявки
  field_all_type_value: string
  field_all_company_value: string
  field_all_fio_value: string
  field_all_fio2_value: string
  field_all_number_value: string
  field_all_phone1_value: string
  field_all_phone2_value: string
  field_all_dakt_value: string
  field_all_adres_value: string
  field_all_account_value: string
  field_all_ddogovor_value: string
  field_all_ndogovor_value: string
  field_all_login_value: string
  field_all_ip_adres_value: string
  field_all_tarif_value: string
  field_all_uzel_value: string
  field_all_vneshka_value: string
  field_all_port_value: string
  field_etap_value: string
  field_all_price_value: string
  field_all_oplata_value: string
  field_all_job_value: string
  field_all_adres2_value: string
  field_all_mac_value: string
  field_all_fio_r_value: string
  field_all_data_value: string
  field_all_nakt_value: string
  field_all_status_value: string
  field_all_kurator_value: string
  field_all_manager_value: string
  field_all_udogovor_value: string
  field_all_ndogovor_tomica_value: string
  field_all_ddogovor_tomica_value: string
  field_srok_value: string
}

interface LegacyComment {
  cid: string
  nid: string
  pid: string
  uid: string
  subject: string
  comment: string
  hostname: string
  timestamp: string
  status: string
  format: string
  thread: string
  created_at: string
  user_name: string
}

interface LegacyFile {
  nid: string
  fid: string
  description: string
  list: string
  weight: string
  filename: string
  filepath: string
  filemime: string
  filesize: string
  timestamp: string
  status: string
  uploaded_at: string
  file_url: string
}

interface LegacyUser {
  uid: string
  name: string
  mail: string
  pass: string
  mode: string
  sort: string
  threshold: string
  theme: string
  signature: string
  signature_format: string
  created: string      // UNIX timestamp или уже конвертированная дата
  access: string       // UNIX timestamp или уже конвертированная дата
  login: string        // UNIX timestamp или уже конвертированная дата
  status: string       // 1 = активный, 0 = заблокирован
  timezone: string
  language: string
  picture: string
  init: string
  data: string
  created_at?: string  // если уже конвертировано
  last_access?: string
  last_login?: string
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

// Маппинг type -> service_type (field_all_type_value)
function mapServiceType(type: string): string {
  const normalizedType = type?.toLowerCase().trim() || ''
  if (normalizedType.includes('домашн') || normalizedType.includes('квартир') || normalizedType.includes('дом')) {
    return 'apartment'
  }
  if (normalizedType.includes('офис') || normalizedType.includes('юр')) {
    return 'office'
  }
  if (normalizedType.includes('скс') || normalizedType.includes('сеть')) {
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

// Проверка что значение не пустое и не NULL
function isValidValue(value: string | undefined | null): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.toUpperCase() === 'NULL') return false
  return true
}

// Получить значение или null (фильтруя NULL строки)
function getValueOrNull(value: string | undefined | null): string | null {
  if (!isValidValue(value)) return null
  return value!.trim()
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
  const usersFile = formData.get('users') as File | null
  const batchSize = parseInt(formData.get('batchSize') as string) || 50
  const recordLimitStr = formData.get('recordLimit') as string | null
  const recordLimit = recordLimitStr ? parseInt(recordLimitStr) : 0 // 0 = без лимита

  // Требуется хотя бы один файл
  if (!ordersFile && !usersFile) {
    return NextResponse.json({ error: 'Требуется хотя бы один файл (orders.tsv или users.tsv)' }, { status: 400 })
  }

  // Парсинг файлов заранее
  let orders: LegacyOrder[] = []
  let totalOrdersBeforeLimit = 0
  if (ordersFile) {
    const ordersText = await ordersFile.text()
    orders = parseTSV<LegacyOrder>(ordersText)
    totalOrdersBeforeLimit = orders.length
    // Применяем лимит записей если указан
    if (recordLimit > 0 && orders.length > recordLimit) {
      orders = orders.slice(0, recordLimit)
    }
  }

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

  let users: LegacyUser[] = []
  if (usersFile) {
    const usersText = await usersFile.text()
    users = parseTSV<LegacyUser>(usersText)
    // Фильтруем анонимного пользователя Drupal (uid=0)
    users = users.filter(u => u.uid !== '0' && u.uid !== '')
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
        users: { total: users.length, imported: 0, skipped: 0, errors: 0 },
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
          total: orders.length + comments.length + files.length + users.length,
          log: log('info', `Начало импорта. Пользователь: ${session.user.email}`),
        })

        sendProgress({
          phase: 'init',
          current: 0,
          total: orders.length + comments.length + files.length + users.length,
          log: log('info', `Найдено: заявок ${totalOrdersBeforeLimit}, комментариев ${comments.length}, файлов ${files.length}, пользователей ${users.length}`),
        })

        if (recordLimit > 0 && totalOrdersBeforeLimit > recordLimit) {
          sendProgress({
            phase: 'init',
            current: 0,
            total: orders.length,
            log: log('warning', `Применён лимит: будет импортировано только ${recordLimit} из ${totalOrdersBeforeLimit} заявок`),
          })
        }

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
          // Используем nid как основной ID
          const legacyId = order.nid?.trim()

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
              // Маппинг stage -> status (field_etap_value)
              const stageValue = getValueOrNull(order.field_etap_value)
              const stageMapping = stageValue ? STAGE_STATUS_MAPPING[stageValue] || {
                status: 'new',
                urgency: 'normal',
              } : { status: 'new', urgency: 'normal' }

              // Определение типа клиента (проверяем что company не NULL)
              const companyValue = getValueOrNull(order.field_all_company_value)
              const fioValue = getValueOrNull(order.field_all_fio_value)
              const fio2Value = getValueOrNull(order.field_all_fio2_value)

              const hasCompany = !!companyValue
              const customerType = hasCompany ? 'business' : 'individual'
              const customerFullname = hasCompany
                ? companyValue
                : fioValue || 'Не указано'
              // Для юрлиц: основное ФИО как контактное лицо, для физлиц: второе ФИО
              const contactPerson = hasCompany
                ? fioValue || fio2Value
                : fio2Value

              // Телефоны (фильтруем NULL)
              const phone1 = getValueOrNull(order.field_all_phone1_value)
              const phone2 = getValueOrNull(order.field_all_phone2_value)
              const customerPhone = phone1 || ''
              const contactPhone = phone2

              // Парсинг даты (node_created_at уже в формате datetime)
              let createdAt: string | null = null
              if (order.node_created_at) {
                try {
                  const date = new Date(order.node_created_at)
                  if (!isNaN(date.getTime())) {
                    createdAt = date.toISOString()
                  }
                } catch {
                  // ignore
                }
              }

              // Формируем дополнительную информацию для комментария
              const additionalInfo: string[] = []

              // Добавляем создателя заявки
              if (isValidValue(order.node_uid)) additionalInfo.push(`Создал заявку (uid): ${order.node_uid.trim()}`)

              // Технические данные
              if (isValidValue(order.field_all_account_value)) additionalInfo.push(`Лицевой счёт: ${order.field_all_account_value.trim()}`)
              if (isValidValue(order.field_all_ndogovor_value)) additionalInfo.push(`Договор: ${order.field_all_ndogovor_value.trim()}`)
              if (isValidValue(order.field_all_ddogovor_value)) additionalInfo.push(`Дата договора: ${order.field_all_ddogovor_value.trim()}`)
              if (isValidValue(order.field_all_login_value)) additionalInfo.push(`Логин: ${order.field_all_login_value.trim()}`)
              if (isValidValue(order.field_all_ip_adres_value)) additionalInfo.push(`IP: ${order.field_all_ip_adres_value.trim()}`)
              if (isValidValue(order.field_all_tarif_value)) additionalInfo.push(`Тариф: ${order.field_all_tarif_value.trim()}`)
              if (isValidValue(order.field_all_uzel_value)) additionalInfo.push(`Узел: ${order.field_all_uzel_value.trim()}`)
              if (isValidValue(order.field_all_port_value)) additionalInfo.push(`Порт: ${order.field_all_port_value.trim()}`)
              if (isValidValue(order.field_all_mac_value)) additionalInfo.push(`MAC: ${order.field_all_mac_value.trim()}`)
              if (isValidValue(order.field_all_price_value)) additionalInfo.push(`Цена: ${order.field_all_price_value.trim()}`)
              if (isValidValue(order.field_all_oplata_value)) additionalInfo.push(`Оплата: ${order.field_all_oplata_value.trim()}`)
              if (isValidValue(order.field_all_job_value)) additionalInfo.push(`Работы: ${order.field_all_job_value.trim()}`)
              if (isValidValue(order.field_all_kurator_value)) additionalInfo.push(`Куратор: ${order.field_all_kurator_value.trim()}`)
              if (isValidValue(order.field_all_manager_value)) additionalInfo.push(`Менеджер: ${order.field_all_manager_value.trim()}`)

              const clientComment = additionalInfo.length > 0 ? additionalInfo.join('\n') : null

              const applicationData = {
                legacy_id: parseInt(legacyId),
                legacy_stage: stageValue,
                application_number: parseInt(getValueOrNull(order.field_all_number_value) || '') || parseInt(legacyId),
                customer_type: customerType,
                customer_fullname: customerFullname,
                customer_phone: customerPhone,
                contact_person: contactPerson,
                contact_phone: contactPhone,
                service_type: mapServiceType(order.field_all_type_value),
                status: stageMapping.status,
                urgency: stageMapping.urgency,
                street_and_house: getValueOrNull(order.field_all_adres_value),
                address_details: getValueOrNull(order.field_all_adres2_value),
                address_match_status: 'unmatched',
                client_comment: clientComment,
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
                user_name: comment.user_name?.trim() || 'Система',
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
              // Используем filemime из Drupal, если есть
              const mimeType = file.filemime?.trim() || 'application/octet-stream'

              const fileData = {
                legacy_id: parseInt(legacyFid),
                legacy_path: file.filepath?.trim() || file.file_url?.trim() || null,
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

        // ==================== ИМПОРТ ПОЛЬЗОВАТЕЛЕЙ ====================
        if (users.length > 0) {
          sendProgress({
            phase: 'users',
            current: 0,
            total: users.length,
            log: log('info', '=== Импорт пользователей ==='),
          })

          // Debug: показываем колонки первого пользователя
          if (users[0]) {
            const firstUserKeys = Object.keys(users[0])
            sendProgress({
              phase: 'users',
              current: 0,
              total: users.length,
              log: log('info', `Колонки в файле: ${firstUserKeys.join(', ')}`),
            })
            sendProgress({
              phase: 'users',
              current: 0,
              total: users.length,
              log: log('info', `Первый пользователь: uid=${users[0].uid}, name=${users[0].name}, mail=${users[0].mail}`),
            })
          }

          // Получаем существующие legacy_uid
          const { data: existingUsers } = await supabase
            .from('zakaz_users')
            .select('legacy_uid, email')

          const existingLegacyUids = new Set(
            (existingUsers || [])
              .filter((u: { legacy_uid: number | null }) => u.legacy_uid !== null)
              .map((u: { legacy_uid: number | null }) => u.legacy_uid?.toString())
          )
          const existingEmails = new Set(
            (existingUsers || []).map((u: { email: string }) => u.email?.toLowerCase())
          )

          // Маппинг legacy_uid -> new_user_id (для связывания)
          const userIdMapping: Map<string, string> = new Map()

          for (let i = 0; i < users.length; i++) {
            const user = users[i]
            const legacyUid = user.uid?.trim()

            if (!legacyUid || legacyUid === '0') {
              stats.users.skipped++
              continue
            }

            // Проверка: уже импортирован по legacy_uid
            if (existingLegacyUids.has(legacyUid)) {
              stats.users.skipped++
              // Получаем ID для маппинга
              const { data: existing } = await supabase
                .from('zakaz_users')
                .select('id')
                .eq('legacy_uid', parseInt(legacyUid))
                .single() as { data: { id: string } | null }

              if (existing) {
                userIdMapping.set(legacyUid, existing.id)
              }
              continue
            }

            try {
              const userName = getValueOrNull(user.name)
              const userEmail = getValueOrNull(user.mail)

              if (!userName) {
                stats.users.errors++
                continue
              }

              // Проверка: email уже существует
              if (userEmail && existingEmails.has(userEmail.toLowerCase())) {
                stats.users.skipped++
                sendProgress({
                  phase: 'users',
                  current: i + 1,
                  total: users.length,
                  log: log('warning', `Пользователь ${userName}: email ${userEmail} уже существует`),
                })
                continue
              }

              // Парсинг дат (могут быть UNIX timestamp или уже конвертированы)
              let createdAt: string | null = null
              let lastAccess: string | null = null
              let lastLogin: string | null = null

              // created
              const createdValue = user.created_at || user.created
              if (createdValue) {
                try {
                  // Проверяем: это UNIX timestamp (число) или дата
                  const numValue = parseInt(createdValue)
                  if (!isNaN(numValue) && numValue > 100000000) {
                    // UNIX timestamp
                    createdAt = new Date(numValue * 1000).toISOString()
                  } else {
                    // Дата-строка
                    const date = new Date(createdValue)
                    if (!isNaN(date.getTime())) {
                      createdAt = date.toISOString()
                    }
                  }
                } catch {
                  // ignore
                }
              }

              // last_access
              const accessValue = user.last_access || user.access
              if (accessValue) {
                try {
                  const numValue = parseInt(accessValue)
                  if (!isNaN(numValue) && numValue > 100000000) {
                    lastAccess = new Date(numValue * 1000).toISOString()
                  } else {
                    const date = new Date(accessValue)
                    if (!isNaN(date.getTime())) {
                      lastAccess = date.toISOString()
                    }
                  }
                } catch {
                  // ignore
                }
              }

              // last_login
              const loginValue = user.last_login || user.login
              if (loginValue) {
                try {
                  const numValue = parseInt(loginValue)
                  if (!isNaN(numValue) && numValue > 100000000) {
                    lastLogin = new Date(numValue * 1000).toISOString()
                  } else {
                    const date = new Date(loginValue)
                    if (!isNaN(date.getTime())) {
                      lastLogin = date.toISOString()
                    }
                  }
                } catch {
                  // ignore
                }
              }

              // Статус: 1 = активен, 0 = заблокирован
              const isActive = user.status !== '0'

              // Генерируем временный email если нет
              const finalEmail = userEmail || `legacy_${legacyUid}@placeholder.local`

              // Роль по умолчанию - engineer (можно потом изменить)
              const userData = {
                legacy_uid: parseInt(legacyUid),
                legacy_last_access: lastAccess,
                legacy_last_login: lastLogin,
                email: finalEmail.toLowerCase(),
                full_name: userName,
                phone: null,
                role: 'engineer',
                password_hash: 'NEEDS_RESET', // Требуется сброс пароля
                active: isActive,
                created_at: createdAt,
              }

              const { data: inserted, error } = await supabase
                .from('zakaz_users')
                .insert(userData as never)
                .select('id')
                .single() as { data: { id: string } | null; error: { message: string } | null }

              if (error) {
                stats.users.errors++
                if (stats.users.errors <= 5) {
                  sendProgress({
                    phase: 'users',
                    current: i + 1,
                    total: users.length,
                    log: log('error', `Ошибка пользователя ${userName}`, error.message),
                  })
                }
              } else {
                stats.users.imported++
                if (inserted) {
                  userIdMapping.set(legacyUid, inserted.id)
                  existingEmails.add(finalEmail.toLowerCase())
                }
              }
            } catch (error) {
              stats.users.errors++
            }

            // Прогресс каждые batchSize записей
            if ((i + 1) % batchSize === 0 || i === users.length - 1) {
              sendProgress({
                phase: 'users',
                current: i + 1,
                total: users.length,
                stats: { ...stats },
                log: log('info', `Пользователи: обработано ${i + 1}/${users.length}`),
              })
            }
          }

          sendProgress({
            phase: 'users',
            current: users.length,
            total: users.length,
            stats: { ...stats },
            log: log('success', `Пользователи завершены: импортировано ${stats.users.imported}, пропущено ${stats.users.skipped}, ошибок ${stats.users.errors}`),
          })
        }

        // Финал
        const duration = Date.now() - startTime
        const success = stats.orders.errors === 0 &&
                       stats.comments.errors === 0 &&
                       stats.files.errors === 0 &&
                       stats.users.errors === 0

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
