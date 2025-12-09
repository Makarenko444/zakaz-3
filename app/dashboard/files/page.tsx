'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getCurrentUser } from '@/lib/auth-client'
import { User } from '@/lib/types'

type FileTypeFilter = 'all' | 'images' | 'pdf' | 'documents' | 'spreadsheets' | 'archives' | 'other'

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
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all')

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
      if (typeFilter !== 'all') {
        params.set('type', typeFilter)
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
  }, [page, search, sortBy, sortDir, typeFilter])

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

  function FileIcon({ mimeType }: { mimeType: string }) {
    const className = "w-8 h-8"

    if (mimeType.startsWith('image/')) {
      return (
        <svg className={className} fill="none" stroke="#10B981" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
    if (mimeType === 'application/pdf') {
      return (
        <svg className={className} fill="none" stroke="#EF4444" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6M9 17h4" />
        </svg>
      )
    }
    if (mimeType.includes('word') || mimeType.includes('document')) {
      return (
        <svg className={className} fill="none" stroke="#3B82F6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return (
        <svg className={className} fill="none" stroke="#8B5CF6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M9 4v16M15 4v16M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
        </svg>
      )
    }
    if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('rar')) {
      return (
        <svg className={className} fill="none" stroke="#F59E0B" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )
    }
    return (
      <svg className={className} fill="none" stroke="#6B7280" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }

  function canPreview(mimeType: string): boolean {
    return mimeType.startsWith('image/') || mimeType === 'application/pdf'
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Статистика по типам файлов</h2>
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Donut-диаграмма слева */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <svg width="200" height="200" viewBox="0 0 200 200">
                  {(() => {
                    const typeColors: Record<string, string> = {
                      'Таблицы': '#6366F1',
                      'Документы': '#22C55E',
                      'Изображения': '#F59E0B',
                      'PDF': '#EF4444',
                      'Другие': '#06B6D4',
                      'Архивы': '#8B5CF6',
                    }
                    const typeFilterMap: Record<string, FileTypeFilter> = {
                      'Изображения': 'images',
                      'PDF': 'pdf',
                      'Документы': 'documents',
                      'Таблицы': 'spreadsheets',
                      'Архивы': 'archives',
                      'Другие': 'other',
                    }
                    const entries = Object.entries(stats.typeStats).sort((a, b) => b[1].count - a[1].count)
                    const total = entries.reduce((sum, [, d]) => sum + d.count, 0)
                    const outerRadius = 95
                    const innerRadius = 65
                    let currentAngle = -90

                    return entries.map(([type, data]) => {
                      const percentage = (data.count / total) * 100
                      const angle = (percentage / 100) * 360
                      const startAngle = currentAngle
                      const endAngle = currentAngle + angle
                      currentAngle = endAngle

                      const startRad = (startAngle * Math.PI) / 180
                      const endRad = (endAngle * Math.PI) / 180
                      const largeArc = angle > 180 ? 1 : 0

                      const x1 = 100 + outerRadius * Math.cos(startRad)
                      const y1 = 100 + outerRadius * Math.sin(startRad)
                      const x2 = 100 + outerRadius * Math.cos(endRad)
                      const y2 = 100 + outerRadius * Math.sin(endRad)
                      const x3 = 100 + innerRadius * Math.cos(endRad)
                      const y3 = 100 + innerRadius * Math.sin(endRad)
                      const x4 = 100 + innerRadius * Math.cos(startRad)
                      const y4 = 100 + innerRadius * Math.sin(startRad)

                      const pathD = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`

                      const filterValue = typeFilterMap[type] || 'all'
                      const isActive = typeFilter === filterValue
                      const isFiltered = typeFilter !== 'all'
                      const opacity = isFiltered ? (isActive ? 1 : 0.25) : 1

                      return (
                        <path
                          key={type}
                          d={pathD}
                          fill={typeColors[type] || '#6B7280'}
                          stroke="white"
                          strokeWidth="3"
                          opacity={opacity}
                          className="cursor-pointer transition-all duration-200 hover:opacity-80"
                          onClick={() => {
                            setTypeFilter(isActive ? 'all' : filterValue)
                            setPage(1)
                          }}
                        />
                      )
                    })
                  })()}
                </svg>
                {/* Центр с числом */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-gray-900">{stats.totalFiles}</span>
                  <span className="text-sm text-gray-500">файлов</span>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Всего: {formatFileSize(stats.totalSize)}
              </div>
            </div>

            {/* Легенда справа */}
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-4">Нажмите на тип для фильтрации:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(stats.typeStats)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([type, data]) => {
                    const typeColors: Record<string, string> = {
                      'Таблицы': 'bg-indigo-500',
                      'Документы': 'bg-green-500',
                      'Изображения': 'bg-amber-500',
                      'PDF': 'bg-red-500',
                      'Другие': 'bg-cyan-500',
                      'Архивы': 'bg-purple-500',
                    }
                    const typeNames: Record<string, string> = {
                      'Таблицы': 'Таблицы Excel',
                      'Документы': 'Документы Word',
                      'Изображения': 'Изображения',
                      'PDF': 'PDF документы',
                      'Другие': 'Другие',
                      'Архивы': 'Архивы',
                    }
                    const typeFilterMap: Record<string, FileTypeFilter> = {
                      'Изображения': 'images',
                      'PDF': 'pdf',
                      'Документы': 'documents',
                      'Таблицы': 'spreadsheets',
                      'Архивы': 'archives',
                      'Другие': 'other',
                    }
                    const percentage = stats.totalFiles > 0
                      ? Math.round((data.count / stats.totalFiles) * 100)
                      : 0
                    const filterValue = typeFilterMap[type] || 'all'
                    const isActive = typeFilter === filterValue
                    const isFiltered = typeFilter !== 'all'
                    const isDimmed = isFiltered && !isActive

                    return (
                      <button
                        key={type}
                        onClick={() => {
                          setTypeFilter(isActive ? 'all' : filterValue)
                          setPage(1)
                        }}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                          isActive
                            ? 'border-indigo-500 bg-indigo-50 shadow-md'
                            : isDimmed
                            ? 'border-gray-100 bg-gray-50 opacity-40'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${typeColors[type] || 'bg-gray-500'}`}></div>
                          <div className="text-left">
                            <div className={`text-sm font-medium ${isDimmed ? 'text-gray-400' : 'text-gray-900'}`}>
                              {typeNames[type] || type}
                            </div>
                            <div className={`text-xs ${isDimmed ? 'text-gray-300' : 'text-gray-500'}`}>
                              {formatFileSize(data.size)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-semibold ${isDimmed ? 'text-gray-400' : 'text-gray-900'}`}>
                            {data.count}
                          </div>
                          <div className={`text-xs ${isDimmed ? 'text-gray-300' : 'text-gray-500'}`}>
                            {percentage}%
                          </div>
                        </div>
                      </button>
                    )
                  })}
              </div>
              {typeFilter !== 'all' && (
                <button
                  onClick={() => { setTypeFilter('all'); setPage(1) }}
                  className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Сбросить фильтр
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Заголовок, поиск и фильтры */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Список файлов</h1>
            <p className="text-sm text-gray-500 mt-1">Найдено: {total}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Фильтр по типу */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as FileTypeFilter)
                setPage(1)
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              <option value="all">Все типы</option>
              <option value="images">Изображения</option>
              <option value="pdf">PDF</option>
              <option value="documents">Документы</option>
              <option value="spreadsheets">Таблицы</option>
              <option value="archives">Архивы</option>
              <option value="other">Другие</option>
            </select>
            {/* Поиск */}
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
                      <div className="flex items-center gap-3">
                        {/* Миниатюра для изображений или иконка */}
                        {file.mime_type?.startsWith('image/') ? (
                          <div
                            className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-200 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition relative"
                            onClick={() => setPreviewFile(file)}
                            title="Нажмите для просмотра"
                          >
                            <Image
                              src={`/api/applications/${file.application_id}/files/${file.id}`}
                              alt={file.original_filename}
                              fill
                              className="object-cover"
                              unoptimized
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                                if (e.currentTarget.parentElement) {
                                  e.currentTarget.parentElement.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg class="w-8 h-8" fill="none" stroke="#10B981" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>'
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <FileIcon mimeType={file.mime_type} />
                        )}
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
                    <td className="px-4 py-3 text-right space-x-3">
                      {canPreview(file.mime_type) && (
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="text-green-600 hover:text-green-900 text-sm font-medium"
                        >
                          Просмотр
                        </button>
                      )}
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

      {/* Модальное окно просмотра */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="bg-white rounded-lg max-w-5xl max-h-[90vh] w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Заголовок */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon mimeType={previewFile.mime_type} />
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{previewFile.original_filename}</div>
                  <div className="text-sm text-gray-500">{formatFileSize(previewFile.file_size)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/applications/${previewFile.application_id}/files/${previewFile.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                >
                  Скачать
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Контент */}
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)] flex items-center justify-center bg-gray-100">
              {previewFile.mime_type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/applications/${previewFile.application_id}/files/${previewFile.id}`}
                  alt={previewFile.original_filename}
                  className="max-w-full max-h-[calc(90vh-120px)] object-contain"
                />
              ) : previewFile.mime_type === 'application/pdf' ? (
                <iframe
                  src={`/api/applications/${previewFile.application_id}/files/${previewFile.id}`}
                  className="w-full h-[calc(90vh-120px)]"
                  title={previewFile.original_filename}
                />
              ) : (
                <div className="text-center text-gray-500 py-12">
                  Предпросмотр недоступен для этого типа файла
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
