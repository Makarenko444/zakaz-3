'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface FileRecord {
  id: string
  application_id: string
  original_filename: string
  stored_filename: string
  file_size: number
  mime_type: string
  uploaded_at: string
  legacy_path: string | null
  existsLocally?: boolean
  needsMigration?: boolean
  reason?: string
  application?: {
    application_number: number
    customer_fullname: string
  } | null
}

interface OrphanFile {
  path: string
  applicationId: string
  filename: string
  size: number
}

type ViewMode = 'list' | 'zombies' | 'orphans' | 'no-application'

export default function FileManagementAdmin() {
  const [mode, setMode] = useState<ViewMode>('list')
  const [files, setFiles] = useState<FileRecord[]>([])
  const [orphanFiles, setOrphanFiles] = useState<OrphanFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setSelectedFiles(new Set())
    setSelectedOrphans(new Set())

    try {
      const params = new URLSearchParams({
        mode,
        page: page.toString(),
        limit: '50',
      })
      if (search) {
        params.set('search', search)
      }

      const response = await fetch(`/api/admin/files?${params}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (mode === 'orphans') {
        setOrphanFiles(data.files || [])
        setFiles([])
      } else {
        setFiles(data.files || [])
        setOrphanFiles([])
      }

      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }, [mode, page, search])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0 && selectedOrphans.size === 0) return

    const confirmMsg = mode === 'orphans'
      ? `Удалить ${selectedOrphans.size} файлов с диска?`
      : `Удалить ${selectedFiles.size} записей из БД?`

    if (!confirm(confirmMsg)) return

    setIsDeleting(true)
    try {
      const body: { fileIds?: string[]; orphanPaths?: string[] } = {}

      if (mode === 'orphans') {
        body.orphanPaths = Array.from(selectedOrphans)
      } else {
        body.fileIds = Array.from(selectedFiles)
      }

      const response = await fetch('/api/admin/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      alert(`Удалено: ${result.deleted}${result.errors?.length ? `\nОшибок: ${result.errors.length}` : ''}`)

      loadFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Б'
    const k = 1024
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const toggleFileSelection = (id: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedFiles(newSelected)
  }

  const toggleOrphanSelection = (path: string) => {
    const newSelected = new Set(selectedOrphans)
    if (newSelected.has(path)) {
      newSelected.delete(path)
    } else {
      newSelected.add(path)
    }
    setSelectedOrphans(newSelected)
  }

  const selectAll = () => {
    if (mode === 'orphans') {
      setSelectedOrphans(new Set(orphanFiles.map(f => f.path)))
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)))
    }
  }

  const deselectAll = () => {
    setSelectedFiles(new Set())
    setSelectedOrphans(new Set())
  }

  const getModeLabel = (m: ViewMode) => {
    switch (m) {
      case 'list': return 'Все файлы'
      case 'zombies': return 'Зомби (нет на диске)'
      case 'orphans': return 'Сироты (нет в БД)'
      case 'no-application': return 'Без заявки'
    }
  }

  const getModeDescription = (m: ViewMode) => {
    switch (m) {
      case 'list': return 'Все файлы в базе данных'
      case 'zombies': return 'Записи в БД без файла на диске (не legacy)'
      case 'orphans': return 'Файлы на диске без записи в БД'
      case 'no-application': return 'Файлы с несуществующей заявкой'
    }
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Управление файлами</h2>
        <p className="text-sm text-gray-600">
          Просмотр всех файлов, поиск зомби-файлов и файлов-сирот.
        </p>
      </div>

      {/* Режимы просмотра */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {(['list', 'zombies', 'orphans', 'no-application'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setPage(1); setSearch(''); setSearchInput(''); }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getModeLabel(m)}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500">{getModeDescription(mode)}</p>
      </div>

      {/* Поиск (только для list) */}
      {mode === 'list' && (
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск по имени файла..."
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
            >
              Найти
            </button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSearchInput(''); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
              >
                Сбросить
              </button>
            )}
          </form>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Статистика и действия */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-600">
            Найдено: <strong>{total}</strong> файлов
            {(selectedFiles.size > 0 || selectedOrphans.size > 0) && (
              <span className="ml-4">
                Выбрано: <strong>{mode === 'orphans' ? selectedOrphans.size : selectedFiles.size}</strong>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadFiles}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Обновить
            </button>
            {(mode === 'zombies' || mode === 'orphans' || mode === 'no-application') && total > 0 && (
              <>
                <button
                  onClick={selectAll}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Выбрать все
                </button>
                <button
                  onClick={deselectAll}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Снять выбор
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting || (selectedFiles.size === 0 && selectedOrphans.size === 0)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Удаление...' : 'Удалить выбранные'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Таблица файлов */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : mode === 'orphans' ? (
          // Таблица orphan файлов
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">
                    <input
                      type="checkbox"
                      checked={selectedOrphans.size === orphanFiles.length && orphanFiles.length > 0}
                      onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Файл</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID заявки</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Размер</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Путь</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orphanFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Файлов-сирот не найдено
                    </td>
                  </tr>
                ) : (
                  orphanFiles.map((file) => (
                    <tr key={file.path} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedOrphans.has(file.path)}
                          onChange={() => toggleOrphanSelection(file.path)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={file.filename}>
                        {file.filename}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {file.applicationId}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-md truncate" title={file.path}>
                        {file.path}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          // Таблица обычных файлов
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {(mode === 'zombies' || mode === 'no-application') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">
                      <input
                        type="checkbox"
                        checked={selectedFiles.size === files.length && files.length > 0}
                        onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Файл</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Заявка</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Размер</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  {(mode === 'zombies' || mode === 'no-application') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Причина</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={mode === 'zombies' || mode === 'no-application' ? 7 : 5} className="px-4 py-8 text-center text-gray-500">
                      {mode === 'zombies' ? 'Зомби-файлов не найдено' :
                       mode === 'no-application' ? 'Файлов без заявки не найдено' :
                       'Файлы не найдены'}
                    </td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50">
                      {(mode === 'zombies' || mode === 'no-application') && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(file.id)}
                            onChange={() => toggleFileSelection(file.id)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={file.original_filename}>
                        {file.original_filename}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {file.application ? (
                          <Link
                            href={`/applications/${file.application_id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            №{file.application.application_number}
                            <span className="text-gray-500 ml-1">
                              ({file.application.customer_fullname})
                            </span>
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatFileSize(file.file_size)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(file.uploaded_at)}
                      </td>
                      <td className="px-4 py-3">
                        {file.existsLocally ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Локальный
                          </span>
                        ) : file.legacy_path ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Legacy
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Отсутствует
                          </span>
                        )}
                      </td>
                      {(mode === 'zombies' || mode === 'no-application') && (
                        <td className="px-4 py-3 text-sm text-red-600">
                          {file.reason}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Пагинация */}
        {mode === 'list' && totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Назад
            </button>
            <span className="text-sm text-gray-600">
              Страница {page} из {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Вперёд
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
