'use client'

import { useState, useEffect, useCallback } from 'react'

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

export default function FileMigrationAdmin() {
  const [status, setStatus] = useState<MigrationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([])
  const [batchSize, setBatchSize] = useState(10)

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/admin/migrate-files')
      if (!response.ok) {
        throw new Error('Не удалось загрузить статус миграции')
      }
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleMigrateAll = async () => {
    if (!status || status.pending === 0) return

    setIsMigrating(true)
    setMigrationResults([])
    setError(null)

    try {
      const response = await fetch('/api/admin/migrate-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: batchSize }),
      })

      if (!response.ok) {
        throw new Error('Ошибка миграции')
      }

      const data = await response.json()
      setMigrationResults(data.results)

      // Обновляем статус
      await loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка миграции')
    } finally {
      setIsMigrating(false)
    }
  }

  const handleMigrateOne = async (fileId: string) => {
    setIsMigrating(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/migrate-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: [fileId] }),
      })

      if (!response.ok) {
        throw new Error('Ошибка миграции')
      }

      const data = await response.json()
      setMigrationResults((prev) => [...data.results, ...prev])

      // Обновляем статус
      await loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка миграции')
    } finally {
      setIsMigrating(false)
    }
  }

  if (isLoading) {
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
          открываются через редирект на старый сервер.
        </p>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
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
          <div className="flex items-center gap-4">
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
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
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
                {migrationResults.map((result) => (
                  <tr key={result.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
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
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {result.skipped
                        ? 'Файл уже существует'
                        : result.error || (result.success ? 'Загружен успешно' : '')}
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
            Файлы ожидающие миграции ({status.pending > 50 ? `показаны первые 50 из ${status.pending}` : status.pending})
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
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {file.original_filename}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-md truncate">
                      <a
                        href={file.legacy_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-900"
                        title={file.legacy_url}
                      >
                        {file.legacy_path}
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleMigrateOne(file.id)}
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
