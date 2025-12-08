'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

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

interface DiskInfo {
  total: number
  used: number
  free: number
  percent: number
}

interface FileTypeStats {
  type: string
  label: string
  count: number
  totalSize: number
  percentByCount: number
  percentBySize: number
}

interface StatsData {
  totalCount: number
  totalSize: number
  byType: FileTypeStats[]
}

type ViewMode = 'list' | 'zombies' | 'orphans' | 'no-application'

// Цвета для пирога
const PIE_COLORS = [
  '#4F46E5', // indigo-600
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
]

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
  const [diskInfo, setDiskInfo] = useState<DiskInfo | null>(null)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<FileRecord | null>(null)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<string | null>(null)

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
      if (selectedType) {
        params.set('fileType', selectedType)
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
      if (data.diskInfo) {
        setDiskInfo(data.diskInfo)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }, [mode, page, search, selectedType])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // Загрузка статистики при монтировании
  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true)
      try {
        const response = await fetch('/api/admin/files?mode=stats')
        if (response.ok) {
          const data = await response.json()
          setStats({
            totalCount: data.totalCount,
            totalSize: data.totalSize,
            byType: data.byType,
          })
          if (data.diskInfo) {
            setDiskInfo(data.diskInfo)
          }
        }
      } catch (err) {
        console.error('Error loading stats:', err)
      } finally {
        setStatsLoading(false)
      }
    }
    loadStats()
  }, [])

  // Закрытие модального окна по ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && imageModalOpen) {
        setImageModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [imageModalOpen])

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

  const getFileIcon = (mimeType: string | null | undefined): string => {
    if (!mimeType) return '📎'
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType === 'application/pdf') return '📄'
    if (mimeType.includes('word')) return '📝'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦'
    if (mimeType.startsWith('text/')) return '📃'
    return '📎'
  }

  const handleImageClick = (file: FileRecord) => {
    if (file.mime_type?.startsWith('image/') && file.existsLocally) {
      setSelectedImage(file)
      setImageModalOpen(true)
    }
  }

  const handleDownload = (file: FileRecord) => {
    window.open(`/api/applications/${file.application_id}/files/${file.id}`, '_blank')
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

  // Генерация CSS градиента для пирога с поддержкой выделения выбранного типа
  const generatePieGradient = (data: FileTypeStats[], bySize: boolean = true, highlightType: string | null = null): string => {
    if (!data || data.length === 0) return 'conic-gradient(#e5e7eb 0deg 360deg)'

    const segments: string[] = []
    let currentAngle = 0

    data.forEach((item, index) => {
      const percent = bySize ? item.percentBySize : item.percentByCount
      const angle = (percent / 100) * 360
      const baseColor = PIE_COLORS[index % PIE_COLORS.length]
      // Если выбран тип, затеняем невыбранные сегменты
      const color = highlightType && highlightType !== item.type ? '#d1d5db' : baseColor
      segments.push(`${color} ${currentAngle}deg ${currentAngle + angle}deg`)
      currentAngle += angle
    })

    // Добавляем заполнение до 360 градусов если есть погрешность округления
    if (currentAngle < 360) {
      const lastIndex = data.length - 1
      const lastItem = data[lastIndex]
      const baseColor = PIE_COLORS[lastIndex % PIE_COLORS.length]
      const lastColor = highlightType && highlightType !== lastItem?.type ? '#d1d5db' : baseColor
      segments.push(`${lastColor} ${currentAngle}deg 360deg`)
    }

    return `conic-gradient(${segments.join(', ')})`
  }

  // Обработчик клика по типу файла в статистике
  const handleTypeClick = (type: string) => {
    if (selectedType === type) {
      // Сбросить фильтр
      setSelectedType(null)
    } else {
      // Установить фильтр и сбросить страницу
      setSelectedType(type)
      setPage(1)
      // Переключаемся на режим list для отображения файлов
      if (mode !== 'list') {
        setMode('list')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и информация о диске */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Управление файлами</h2>
            <p className="text-sm text-gray-600">
              Просмотр всех файлов, поиск зомби-файлов и файлов-сирот.
            </p>
          </div>
          {diskInfo && (
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Место на диске</div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      diskInfo.percent > 90 ? 'bg-red-500' :
                      diskInfo.percent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${diskInfo.percent}%` }}
                  ></div>
                </div>
                <span className={`text-sm font-medium ${
                  diskInfo.percent > 90 ? 'text-red-600' :
                  diskInfo.percent > 70 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {diskInfo.percent}%
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {formatFileSize(diskInfo.free)} свободно из {formatFileSize(diskInfo.total)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Статистика по типам файлов */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Статистика по типам файлов</h3>
          {selectedType && (
            <button
              onClick={() => setSelectedType(null)}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Сбросить фильтр
            </button>
          )}
        </div>
        {statsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : stats && stats.byType.length > 0 ? (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Пирог */}
            <div className="flex-shrink-0">
              <div className="relative">
                <div
                  className="w-48 h-48 rounded-full transition-all duration-300"
                  style={{ background: generatePieGradient(stats.byType, true, selectedType) }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                    {selectedType ? (
                      <>
                        <span className="text-xl font-bold text-gray-900">
                          {stats.byType.find(t => t.type === selectedType)?.count || 0}
                        </span>
                        <span className="text-xs text-gray-500 text-center px-1">
                          {stats.byType.find(t => t.type === selectedType)?.label || ''}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-gray-900">{stats.totalCount}</span>
                        <span className="text-xs text-gray-500">файлов</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 mt-2">
                {selectedType
                  ? formatFileSize(stats.byType.find(t => t.type === selectedType)?.totalSize || 0)
                  : `Всего: ${formatFileSize(stats.totalSize)}`
                }
              </p>
            </div>

            {/* Легенда */}
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-2">Нажмите на тип для фильтрации:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {stats.byType.map((item, index) => (
                  <div
                    key={item.type}
                    onClick={() => handleTypeClick(item.type)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedType === item.type
                        ? 'bg-indigo-100 ring-2 ring-indigo-500'
                        : selectedType
                          ? 'bg-gray-100 opacity-50 hover:opacity-75'
                          : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full flex-shrink-0 transition-all ${
                        selectedType && selectedType !== item.type ? 'opacity-30' : ''
                      }`}
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {item.label}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          {item.count}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{formatFileSize(item.totalSize)}</span>
                        <span>{item.percentBySize}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">Нет данных для отображения</p>
        )}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20"></th>
                  {(mode === 'zombies' || mode === 'no-application') && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Причина</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={mode === 'zombies' || mode === 'no-application' ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Миниатюра для изображений */}
                          {file.mime_type?.startsWith('image/') && file.existsLocally ? (
                            <div
                              className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-200 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition relative"
                              onClick={() => handleImageClick(file)}
                              title="Нажмите для просмотра"
                            >
                              <Image
                                src={`/api/applications/${file.application_id}/files/${file.id}`}
                                alt={file.original_filename}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <span className="text-2xl flex-shrink-0">{getFileIcon(file.mime_type)}</span>
                          )}
                          <span className="text-sm text-gray-900 truncate max-w-[200px]" title={file.original_filename}>
                            {file.original_filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {file.application ? (
                          <Link
                            href={`/dashboard/applications/${file.application_id}`}
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {file.existsLocally && (
                            <>
                              {file.mime_type?.startsWith('image/') && (
                                <button
                                  onClick={() => handleImageClick(file)}
                                  className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                  title="Просмотреть"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={() => handleDownload(file)}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                title="Скачать"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
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

      {/* Модальное окно для просмотра изображения */}
      {imageModalOpen && selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setImageModalOpen(false)}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            {/* Кнопка закрытия */}
            <button
              onClick={() => setImageModalOpen(false)}
              className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition text-white shadow-lg z-10"
              title="Закрыть (ESC)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Изображение */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/applications/${selectedImage.application_id}/files/${selectedImage.id}`}
              alt={selectedImage.original_filename}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Информация о файле */}
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-60 text-white p-4 rounded-lg">
              <p className="font-medium text-lg">{selectedImage.original_filename}</p>
              <p className="text-xs text-gray-400 mt-2">
                {formatFileSize(selectedImage.file_size)} • {formatDate(selectedImage.uploaded_at)}
                {selectedImage.application && (
                  <span className="ml-2">
                    • Заявка №{selectedImage.application.application_number}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
