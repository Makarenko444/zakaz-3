'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-client'
import { User } from '@/lib/types'

interface FileStats {
  totalFiles: number
  totalSize: number
  typeStats: Record<string, { count: number; size: number }>
  migratedCount: number
  pendingMigration: number
  recentFiles: number
  monthFiles: number
}

interface FileItem {
  id: string
  application_id: string
  original_filename: string
  stored_filename: string | null
  file_size: number
  mime_type: string
  uploaded_by: string | null
  uploaded_at: string
  description: string | null
  legacy_id: number | null
  legacy_path: string | null
  application?: {
    application_number: number
    customer_fullname: string
  }
  uploader?: {
    full_name: string
  }
}

export default function FilesPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState('uploaded_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [stats, setStats] = useState<FileStats | null>(null)

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        sort_by: sortBy,
        sort_dir: sortDir,
      })
      if (search) {
        params.set('search', search)
      }

      const response = await fetch(`/api/files?${params}`)
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
        setTotalPages(data.pages || 1)
        setTotal(data.total || 0)
      }
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setIsLoading(false)
    }
  }, [page, search, sortBy, sortDir])

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/files/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error loading file stats:', error)
    }
  }, [])

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push('/login')
          return
        }
        setUser(currentUser)
      } catch (error) {
        console.error('Error loading user:', error)
        router.push('/login')
      }
    }
    loadUser()
  }, [router])

  useEffect(() => {
    if (user) {
      loadFiles()
      loadStats()
    }
  }, [user, loadFiles, loadStats])

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  function formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '—'
    }
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType === 'application/pdf') return '📄'
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦'
    return '📎'
  }

  function handleSort(field: string) {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(1)
  }

  function SortIcon({ field }: { field: string }) {
    if (sortBy !== field) return null
    return (
      <svg className="w-4 h-4 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {sortDir === 'asc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        )}
      </svg>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Всего файлов</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalFiles}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Общий размер</div>
            <div className="text-2xl font-bold text-gray-900">{formatFileSize(stats.totalSize)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">За 7 дней</div>
            <div className="text-2xl font-bold text-green-600">{stats.recentFiles}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">За 30 дней</div>
            <div className="text-2xl font-bold text-blue-600">{stats.monthFiles}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">В хранилище</div>
            <div className="text-2xl font-bold text-indigo-600">{stats.migratedCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">На сервере</div>
            <div className="text-2xl font-bold text-amber-600">{stats.pendingMigration}</div>
          </div>
        </div>
      )}

      {/* Статистика по типам файлов */}
      {stats && Object.keys(stats.typeStats).length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">По типам файлов</h2>
          <div className="flex flex-wrap gap-4">
            {Object.entries(stats.typeStats).map(([type, data]) => (
              <div key={type} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-lg">
                  {type === 'Изображения' && '🖼️'}
                  {type === 'PDF' && '📄'}
                  {type === 'Документы' && '📝'}
                  {type === 'Таблицы' && '📊'}
                  {type === 'Архивы' && '📦'}
                  {type === 'Другие' && '📎'}
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-900">{type}</div>
                  <div className="text-xs text-gray-500">{data.count} шт. • {formatFileSize(data.size)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Заголовок и поиск */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Список файлов</h1>
          <p className="text-sm text-gray-500 mt-1">Найдено: {total}</p>
        </div>
        <div className="w-full sm:w-auto">
          <input
            type="text"
            placeholder="Поиск по имени файла..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full sm:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Таблица файлов */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-2 text-gray-600">Загрузка...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {search ? 'Файлы не найдены' : 'Нет файлов'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('original_filename')}
                  >
                    Файл <SortIcon field="original_filename" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Заявка
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('file_size')}
                  >
                    Размер <SortIcon field="file_size" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Загрузил
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('uploaded_at')}
                  >
                    Дата загрузки <SortIcon field="uploaded_at" />
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getFileIcon(file.mime_type)}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={file.original_filename}>
                            {file.original_filename}
                          </div>
                          <div className="text-xs text-gray-500">{file.mime_type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {file.application ? (
                        <button
                          onClick={() => router.push(`/dashboard/applications/${file.application_id}`)}
                          className="text-indigo-600 hover:text-indigo-900 text-sm"
                        >
                          №{file.application.application_number}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatFileSize(file.file_size)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {file.uploader?.full_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(file.uploaded_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/api/applications/${file.application_id}/files/${file.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        Скачать
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow">
          <div className="text-sm text-gray-700">
            Страница {page} из {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Назад
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
