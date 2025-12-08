'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface PendingFile {
  id: string
  application_id: string
  original_filename: string
  legacy_path: string
  legacy_url: string
  migrated: boolean
}

interface MigrationStatus {
  total: number
  migrated: number
  pending: number
  pendingFiles: PendingFile[]
}

interface MigrationResult {
  id: string
  filename: string
  success: boolean
  error?: string
  skipped?: boolean
}

interface LogEntry {
  time: string
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
}

export default function FileMigrationAdmin() {
  const [status, setStatus] = useState<MigrationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([])
  const [batchSize, setBatchSize] = useState(10)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString('ru-RU')
    setLogs((prev) => [...prev, { time, type, message }])
    // Auto-scroll to bottom
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight
      }
    }, 10)
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      addLog('info', 'Загрузка статуса миграции...')

      const response = await fetch('/api/admin/migrate-files')
      const responseText = await response.text()

      if (!response.ok) {
        addLog('error', `Ошибка загрузки: HTTP ${response.status} - ${responseText}`)
        throw new Error(`HTTP ${response.status}: ${responseText}`)
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch {
        addLog('error', `Ошибка парсинга JSON: ${responseText.substring(0, 200)}`)
        throw new Error('Невалидный JSON ответ')
      }

      setStatus(data)
      addLog('success', `Статус загружен: ${data.migrated}/${data.total} мигрировано, ${data.pending} ожидает`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Неизвестная ошибка'
      setError(errorMsg)
      addLog('error', `Ошибка: ${errorMsg}`)
    } finally {
      setIsLoading(false)
    }
  }, [addLog])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleMigrateAll = async () => {
    if (!status || status.pending === 0 || status.pendingFiles.length === 0) return

    setIsMigrating(true)
    setMigrationResults([])
    setError(null)

    // Берём ID файлов из списка pendingFiles (уже проверенных как немигрированные)
    const filesToMigrate = status.pendingFiles.slice(0, batchSize)
    const fileIds = filesToMigrate.map(f => f.id)

    addLog('info', `Начинаем миграцию ${fileIds.length} файлов...`)

    try {
      const startTime = Date.now()

      const response = await fetch('/api/admin/migrate-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds }),
      })

      const responseText = await response.text()
      addLog('info', `Ответ сервера (${Date.now() - startTime}мс): статус ${response.status}`)

      if (!response.ok) {
        addLog('error', `Ошибка HTTP ${response.status}: ${responseText.substring(0, 500)}`)
        throw new Error(`HTTP ${response.status}: ${responseText}`)
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch {
        addLog('error', `Ошибка парсинга JSON: ${responseText.substring(0, 500)}`)
        throw new Error('Невалидный JSON ответ от сервера')
      }

      // Логируем результаты
      if (data.results && Array.isArray(data.results)) {
        const successful = data.results.filter((r: MigrationResult) => r.success && !r.skipped).length
        const skipped = data.results.filter((r: MigrationResult) => r.skipped).length
        const failed = data.results.filter((r: MigrationResult) => !r.success)

        addLog('success', `Завершено: ${successful} загружено, ${skipped} пропущено, ${failed.length} ошибок`)

        // Логируем каждую ошибку отдельно
        failed.forEach((f: MigrationResult) => {
          addLog('error', `Файл "${f.filename}": ${f.error || 'неизвестная ошибка'}`)
        })

        setMigrationResults(data.results)
      } else {
        addLog('warning', `Неожиданный формат ответа: ${JSON.stringify(data).substring(0, 300)}`)
      }

      // Обновляем статус
      await loadStatus()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Неизвестная ошибка'
      setError(errorMsg)
      addLog('error', `Критическая ошибка: ${errorMsg}`)
    } finally {
      setIsMigrating(false)
    }
  }

  const handleMigrateOne = async (fileId: string, filename: string) => {
    setIsMigrating(true)
    setError(null)
    addLog('info', `Миграция файла: ${filename}`)

    try {
      const response = await fetch('/api/admin/migrate-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: [fileId] }),
      })

      const responseText = await response.text()

      if (!response.ok) {
        addLog('error', `Ошибка HTTP ${response.status}: ${responseText.substring(0, 300)}`)
        throw new Error(`HTTP ${response.status}`)
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch {
        addLog('error', `Ошибка парсинга: ${responseText.substring(0, 200)}`)
        throw new Error('Невалидный JSON')
      }

      if (data.results?.[0]) {
        const result = data.results[0]
        if (result.success) {
          addLog('success', `Файл "${filename}" успешно мигрирован`)
        } else {
          addLog('error', `Файл "${filename}": ${result.error || 'ошибка'}`)
        }
        setMigrationResults((prev) => [result, ...prev])
      }

      await loadStatus()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Ошибка'
      setError(errorMsg)
      addLog('error', `Ошибка миграции "${filename}": ${errorMsg}`)
    } finally {
      setIsMigrating(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  if (isLoading && logs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2 text-gray-600">Загрузка статуса...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Миграция файлов со старого сервера</h2>
        <p className="text-sm text-gray-600">
          Загрузка файлов с сервера zakaz.tomica.ru в локальное хранилище. До миграции файлы
          открываются через проксирование со старого сервера.
        </p>
      </div>

      {/* Лог */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium text-gray-900">Лог операций</h3>
          <button
            onClick={clearLogs}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Очистить
          </button>
        </div>
        <div
          ref={logRef}
          className="bg-gray-900 text-gray-100 font-mono text-xs p-4 rounded-lg h-48 overflow-y-auto"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500">Лог пуст</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="mb-1">
                <span className="text-gray-500">[{log.time}]</span>{' '}
                <span
                  className={
                    log.type === 'error'
                      ? 'text-red-400'
                      : log.type === 'success'
                      ? 'text-green-400'
                      : log.type === 'warning'
                      ? 'text-yellow-400'
                      : 'text-blue-400'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Ошибка: </strong>
          <span className="block sm:inline whitespace-pre-wrap break-all">{error}</span>
          <button
            onClick={() => setError(null)}
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
          >
            <span className="sr-only">Закрыть</span>
            &times;
          </button>
        </div>
      )}

      {/* Статистика */}
      {status && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Статус миграции</h3>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-900">{status.total}</div>
              <div className="text-sm text-gray-600">Всего legacy-файлов</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{status.migrated}</div>
              <div className="text-sm text-gray-600">Мигрировано</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{status.pending}</div>
              <div className="text-sm text-gray-600">Ожидает миграции</div>
            </div>
          </div>

          {/* Прогресс-бар */}
          {status.total > 0 && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Прогресс миграции</span>
                <span>{Math.round((status.migrated / status.total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-green-600 h-2.5 rounded-full transition-all"
                  style={{ width: `${(status.migrated / status.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Кнопки управления */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="batchSize" className="text-sm text-gray-600">
                Файлов за раз:
              </label>
              <select
                id="batchSize"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                disabled={isMigrating}
              >
                <option value={1}>1</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={300}>300</option>
                <option value={500}>500</option>
              </select>
            </div>

            <button
              onClick={handleMigrateAll}
              disabled={isMigrating || status.pending === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMigrating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Миграция...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Мигрировать {Math.min(batchSize, status.pending)} файлов
                </>
              )}
            </button>

            <button
              onClick={loadStatus}
              disabled={isLoading || isMigrating}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Обновить
            </button>
          </div>
        </div>
      )}

      {/* Результаты последней миграции */}
      {migrationResults.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Результаты миграции</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Файл
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сообщение
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {migrationResults.map((result, idx) => (
                  <tr key={`${result.id}-${idx}`}>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={result.filename}>
                      {result.filename}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {result.success ? (
                        result.skipped ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Пропущен
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Успешно
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Ошибка
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-md">
                      <span className="break-all">
                        {result.skipped
                          ? 'Файл уже существует'
                          : result.error || (result.success ? 'Загружен успешно' : '')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Список ожидающих файлов */}
      {status && status.pendingFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Файлы ожидающие миграции ({status.pending > 500 ? `показаны первые 500 из ${status.pending}` : status.pending})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Имя файла
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Legacy URL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {status.pendingFiles.map((file) => (
                  <tr key={file.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={file.original_filename}>
                      {file.original_filename}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-md">
                      <a
                        href={file.legacy_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-900 break-all"
                        title={file.legacy_url}
                      >
                        {file.legacy_path}
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleMigrateOne(file.id, file.original_filename)}
                        disabled={isMigrating}
                        className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                      >
                        Мигрировать
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Пустое состояние */}
      {status && status.pending === 0 && status.total > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-green-800">Все файлы мигрированы!</h3>
          <p className="mt-1 text-sm text-green-600">
            Все {status.total} legacy-файлов успешно загружены в новую систему.
          </p>
        </div>
      )}

      {/* Нет файлов */}
      {status && status.total === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Нет legacy-файлов</h3>
          <p className="mt-1 text-sm text-gray-500">
            Не найдено файлов для миграции. Сначала импортируйте файлы через раздел &laquo;Импорт данных&raquo;.
          </p>
        </div>
      )}
    </div>
  )
}
