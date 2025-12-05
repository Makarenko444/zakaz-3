'use client'

import { useState, useRef } from 'react'

// Типы для результатов импорта
interface ImportLogEntry {
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  details?: string
}

interface ImportStats {
  orders: {
    total: number
    imported: number
    skipped: number
    errors: number
  }
  comments: {
    total: number
    imported: number
    skipped: number
    errors: number
  }
  files: {
    total: number
    imported: number
    skipped: number
    errors: number
  }
}

interface ProgressData {
  phase: string
  current: number
  total: number
  log?: ImportLogEntry
  stats?: ImportStats
  done?: boolean
}

// Маппинг stage -> status
const STAGE_STATUS_MAPPING: Record<string, { status: string; urgency?: string }> = {
  '1. Новая заявка': { status: 'new' },
  '1.1. Собираем группу': { status: 'no_tech' },
  '1.2. Аварийная заявка': { status: 'new', urgency: 'critical' },
  '1.3. Заказчик думает': { status: 'thinking' },
  '1.4. Потенциальный клиент': { status: 'thinking' },
  '1.5. Переоформление договора': { status: 'contract' },
  '2. Расчет стоимости': { status: 'estimation' },
  '2.1. Расчет выполнен': { status: 'estimation' },
  '3. Заключение договора': { status: 'contract' },
  '4. Ждем оплату': { status: 'contract' },
  '5. Проектирование': { status: 'design' },
  '5.1. Согласование': { status: 'approval' },
  '6. Очередь на монтаж': { status: 'queue_install' },
  '7. Монтаж': { status: 'install' },
  '8. Пусконаладка': { status: 'install' },
  '9. Выполнена': { status: 'installed' },
  '10. Отказ': { status: 'rejected' },
  '11. Нет техн. возможности': { status: 'no_tech' },
  '12. Дубль заявки': { status: 'rejected' },
}

export default function LegacyImportAdmin() {
  const [ordersFile, setOrdersFile] = useState<File | null>(null)
  const [commentsFile, setCommentsFile] = useState<File | null>(null)
  const [filesFile, setFilesFile] = useState<File | null>(null)
  const [batchSize, setBatchSize] = useState(50)
  const [recordLimit, setRecordLimit] = useState<number | ''>(30) // Лимит записей для теста (пусто = без лимита)

  const [isImporting, setIsImporting] = useState(false)
  const [importLogs, setImportLogs] = useState<ImportLogEntry[]>([])
  const [importStats, setImportStats] = useState<ImportStats | null>(null)
  const [progress, setProgress] = useState<{ phase: string; current: number; total: number } | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [previewData, setPreviewData] = useState<{
    orders: number
    comments: number
    files: number
  } | null>(null)

  const ordersInputRef = useRef<HTMLInputElement>(null)
  const commentsInputRef = useRef<HTMLInputElement>(null)
  const filesInputRef = useRef<HTMLInputElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Парсинг TSV файла
  async function parseTSV(file: File): Promise<Record<string, string>[]> {
    const text = await file.text()
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

  // Предпросмотр загруженных файлов
  async function handlePreview() {
    const preview = {
      orders: 0,
      comments: 0,
      files: 0,
    }

    if (ordersFile) {
      const rows = await parseTSV(ordersFile)
      preview.orders = rows.length
    }
    if (commentsFile) {
      const rows = await parseTSV(commentsFile)
      preview.comments = rows.length
    }
    if (filesFile) {
      const rows = await parseTSV(filesFile)
      preview.files = rows.length
    }

    setPreviewData(preview)
  }

  // Запуск импорта со streaming
  async function handleImport() {
    if (!ordersFile) {
      alert('Загрузите файл orders.tsv')
      return
    }

    setIsImporting(true)
    setImportLogs([])
    setImportStats(null)
    setProgress(null)
    setIsDone(false)

    try {
      const formData = new FormData()
      formData.append('orders', ordersFile)
      formData.append('batchSize', batchSize.toString())
      if (recordLimit !== '' && recordLimit > 0) {
        formData.append('recordLimit', recordLimit.toString())
      }
      if (commentsFile) {
        formData.append('comments', commentsFile)
      }
      if (filesFile) {
        formData.append('files', filesFile)
      }

      const response = await fetch('/api/admin/legacy-import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка импорта')
      }

      // Читаем streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Streaming не поддерживается')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Парсим SSE события
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || '' // Оставляем неполное событие в буфере

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: ProgressData = JSON.parse(line.slice(6))

              // Обновляем состояние
              if (data.log) {
                setImportLogs(prev => [...prev, data.log!])
                // Автоскролл лога
                setTimeout(() => {
                  if (logContainerRef.current) {
                    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
                  }
                }, 10)
              }

              if (data.stats) {
                setImportStats(data.stats)
              }

              setProgress({
                phase: data.phase,
                current: data.current,
                total: data.total,
              })

              if (data.done) {
                setIsDone(true)
                setIsImporting(false)
              }
            } catch (e) {
              console.error('Error parsing SSE:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Import error:', error)
      setImportLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: error instanceof Error ? error.message : 'Неизвестная ошибка',
      }])
      setIsDone(true)
    } finally {
      setIsImporting(false)
    }
  }

  // Скачивание лога
  function downloadLog() {
    const logText = importLogs
      .map(entry => `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${entry.details ? '\n  ' + entry.details : ''}`)
      .join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `import-log-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Скачивание отчёта
  function downloadReport() {
    const report = {
      date: new Date().toISOString(),
      statistics: importStats,
      stageMapping: STAGE_STATUS_MAPPING,
      log: importLogs,
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `import-report-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Расчёт процента прогресса
  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  // Название фазы
  const phaseNames: Record<string, string> = {
    init: 'Инициализация',
    orders: 'Импорт заявок',
    comments: 'Импорт комментариев',
    files: 'Импорт файлов',
    done: 'Завершено',
    error: 'Ошибка',
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Импорт данных из старой системы
        </h2>
        <p className="text-gray-600">
          Загрузите TSV файлы из старой системы Drupal (zakaz_all) для импорта заявок, комментариев и файлов.
        </p>
      </div>

      {/* Загрузка файлов */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Загрузка файлов</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Orders */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-indigo-400 transition">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h4 className="mt-2 text-sm font-medium text-gray-900">orders.tsv</h4>
              <p className="mt-1 text-xs text-gray-500">Заявки (обязательно)</p>

              <input
                ref={ordersInputRef}
                type="file"
                accept=".tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  setOrdersFile(e.target.files?.[0] || null)
                  setPreviewData(null)
                }}
              />

              <button
                onClick={() => ordersInputRef.current?.click()}
                disabled={isImporting}
                className="mt-3 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50"
              >
                {ordersFile ? 'Заменить' : 'Выбрать'}
              </button>

              {ordersFile && (
                <p className="mt-2 text-xs text-green-600 truncate">
                  {ordersFile.name}
                </p>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-indigo-400 transition">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <h4 className="mt-2 text-sm font-medium text-gray-900">order_comments.tsv</h4>
              <p className="mt-1 text-xs text-gray-500">Комментарии (опционально)</p>

              <input
                ref={commentsInputRef}
                type="file"
                accept=".tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  setCommentsFile(e.target.files?.[0] || null)
                  setPreviewData(null)
                }}
              />

              <button
                onClick={() => commentsInputRef.current?.click()}
                disabled={isImporting}
                className="mt-3 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50"
              >
                {commentsFile ? 'Заменить' : 'Выбрать'}
              </button>

              {commentsFile && (
                <p className="mt-2 text-xs text-green-600 truncate">
                  {commentsFile.name}
                </p>
              )}
            </div>
          </div>

          {/* Files */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-indigo-400 transition">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <h4 className="mt-2 text-sm font-medium text-gray-900">order_files.tsv</h4>
              <p className="mt-1 text-xs text-gray-500">Файлы (опционально)</p>

              <input
                ref={filesInputRef}
                type="file"
                accept=".tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  setFilesFile(e.target.files?.[0] || null)
                  setPreviewData(null)
                }}
              />

              <button
                onClick={() => filesInputRef.current?.click()}
                disabled={isImporting}
                className="mt-3 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50"
              >
                {filesFile ? 'Заменить' : 'Выбрать'}
              </button>

              {filesFile && (
                <p className="mt-2 text-xs text-green-600 truncate">
                  {filesFile.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Настройки и кнопки */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Лимит записей:</label>
            <input
              type="number"
              value={recordLimit}
              onChange={(e) => setRecordLimit(e.target.value === '' ? '' : parseInt(e.target.value))}
              disabled={isImporting}
              placeholder="все"
              min={0}
              className="w-20 px-3 py-1 border rounded text-sm"
            />
            <span className="text-xs text-gray-400">(пусто = все)</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Размер блока:</label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              disabled={isImporting}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          <button
            onClick={handlePreview}
            disabled={!ordersFile || isImporting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Предпросмотр
          </button>

          <button
            onClick={handleImport}
            disabled={!ordersFile || isImporting}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isImporting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Импорт...
              </>
            ) : (
              'Запустить импорт'
            )}
          </button>
        </div>

        {/* Предпросмотр */}
        {previewData && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Предпросмотр:</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Заявок:</span>{' '}
                <span className="font-medium">{previewData.orders}</span>
              </div>
              <div>
                <span className="text-gray-500">Комментариев:</span>{' '}
                <span className="font-medium">{previewData.comments}</span>
              </div>
              <div>
                <span className="text-gray-500">Файлов:</span>{' '}
                <span className="font-medium">{previewData.files}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Прогресс импорта */}
      {(isImporting || isDone) && progress && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {isImporting ? 'Прогресс импорта' : 'Результаты импорта'}
            </h3>
            {isDone && (
              <div className="flex gap-2">
                <button
                  onClick={downloadLog}
                  className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Скачать лог
                </button>
                <button
                  onClick={downloadReport}
                  className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Скачать отчёт
                </button>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{phaseNames[progress.phase] || progress.phase}</span>
              <span>{progress.current} / {progress.total} ({progressPercent}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  isDone && importStats?.orders.errors === 0 ? 'bg-green-500' :
                  isDone ? 'bg-yellow-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Статистика */}
          {importStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Заявки</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Всего:</span>
                    <span className="font-medium">{importStats.orders.total}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Импортировано:</span>
                    <span className="font-medium">{importStats.orders.imported}</span>
                  </div>
                  <div className="flex justify-between text-yellow-600">
                    <span>Пропущено:</span>
                    <span className="font-medium">{importStats.orders.skipped}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Ошибок:</span>
                    <span className="font-medium">{importStats.orders.errors}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Комментарии</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Всего:</span>
                    <span className="font-medium">{importStats.comments.total}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Импортировано:</span>
                    <span className="font-medium">{importStats.comments.imported}</span>
                  </div>
                  <div className="flex justify-between text-yellow-600">
                    <span>Пропущено:</span>
                    <span className="font-medium">{importStats.comments.skipped}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Ошибок:</span>
                    <span className="font-medium">{importStats.comments.errors}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Файлы</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Всего:</span>
                    <span className="font-medium">{importStats.files.total}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Импортировано:</span>
                    <span className="font-medium">{importStats.files.imported}</span>
                  </div>
                  <div className="flex justify-between text-yellow-600">
                    <span>Пропущено:</span>
                    <span className="font-medium">{importStats.files.skipped}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Ошибок:</span>
                    <span className="font-medium">{importStats.files.errors}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Лог */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Лог импорта</h4>
            <div
              ref={logContainerRef}
              className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs"
            >
              {importLogs.map((entry, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-500">[{new Date(entry.timestamp).toLocaleTimeString()}]</span>{' '}
                  <span className={
                    entry.level === 'error' ? 'text-red-400' :
                    entry.level === 'warning' ? 'text-yellow-400' :
                    entry.level === 'success' ? 'text-green-400' :
                    'text-gray-300'
                  }>
                    [{entry.level.toUpperCase()}]
                  </span>{' '}
                  <span className="text-gray-100">{entry.message}</span>
                  {entry.details && (
                    <div className="text-gray-500 ml-4">{entry.details}</div>
                  )}
                </div>
              ))}
              {isImporting && (
                <div className="text-gray-500 animate-pulse">Ожидание данных...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Справка по маппингу */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Справка по маппингу</h3>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium text-gray-500">Старый этап (stage)</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Новый статус</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Срочность</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(STAGE_STATUS_MAPPING).map(([stage, mapping]) => (
                <tr key={stage} className="hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-900">{stage}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                      {mapping.status}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {mapping.urgency ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                        {mapping.urgency}
                      </span>
                    ) : (
                      <span className="text-gray-400">normal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
