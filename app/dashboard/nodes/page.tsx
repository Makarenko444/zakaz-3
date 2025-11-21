'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Node, NodeStatus, NodeType } from '@/lib/types'

interface NodesResponse {
  data: Node[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface ImportResult {
  success: boolean
  message: string
  stats: {
    total: number
    processed: number
    duplicates: number
    skipped: number
    errors: number
  }
  details?: {
    duplicates?: Array<{ code: string; reason: string }>
    skipped?: Array<{ row: number; reason: string }>
    errors?: Array<{ row: number; error: string }>
  }
}

const statusLabels: Record<NodeStatus, string> = {
  existing: 'Существующий',
  planned: 'Проектируемый',
}

const nodeTypeLabels: Record<NodeType, string> = {
  prp: 'ПРП (узел связи)',
  ao: 'АО (абонентское окончание)',
  sk: 'СК (СКУД)',
  other: 'Другое (РТК и др.)',
}

const statusColors: Record<NodeStatus, string> = {
  existing: 'bg-green-100 text-green-800',
  planned: 'bg-blue-100 text-blue-800',
}

export default function NodesPage() {
  const router = useRouter()
  const [nodes, setNodes] = useState<Node[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [userRole, setUserRole] = useState<string>('')

  // Модальное окно
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Node>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Импорт
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Фильтры и поиск
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<NodeStatus | ''>('')
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | ''>('')

  useEffect(() => {
    void loadUserRole()
    void loadNodes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadUserRole() {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        setUserRole(data.user?.role || '')
      }
    } catch (error) {
      console.error('Error loading user role:', error)
    }
  }

  async function loadNodes() {
    setIsLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (selectedStatus) params.set('status', selectedStatus)
      if (selectedNodeType) params.set('node_type', selectedNodeType)
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/nodes?${params}`)

      if (!response.ok) {
        throw new Error('Failed to load nodes')
      }

      const data: NodesResponse = await response.json()
      setNodes(data.data)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error loading nodes:', error)
      setError('Не удалось загрузить список узлов')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportResult(null)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/nodes/import', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Import failed')
      }

      setImportResult(result)

      // Перезагружаем список узлов
      await loadNodes()
    } catch (error) {
      console.error('Error importing nodes:', error)
      setError(`Ошибка импорта: ${error}`)
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function handleSearch() {
    loadNodes()
  }

  function handleClearFilters() {
    setSearchQuery('')
    setSelectedStatus('')
    setSelectedNodeType('')
  }

  function openNodeModal(node: Node) {
    console.log('Opening node modal with data:', node)
    setSelectedNode(node)
    setEditForm(node)
    setIsEditing(false)
  }

  function closeNodeModal() {
    setSelectedNode(null)
    setIsEditing(false)
    setEditForm({})
  }

  async function handleSaveNode() {
    if (!selectedNode) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/nodes/${selectedNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        throw new Error('Failed to save node')
      }

      await loadNodes()
      closeNodeModal()
    } catch (error) {
      console.error('Error saving node:', error)
      setError('Ошибка при сохранении узла')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && nodes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Узлы подключения</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Всего: <span className="font-semibold">{pagination.total}</span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Импорт...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Импорт из Excel
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Результат импорта */}
        {importResult && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-green-800">{importResult.message}</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Всего строк: {importResult.stats.total}</p>
                  <p>Обработано (добавлено/обновлено): {importResult.stats.processed}</p>
                  {importResult.stats.duplicates > 0 && <p className="text-yellow-600">Дубликатов объединено: {importResult.stats.duplicates}</p>}
                  {importResult.stats.skipped > 0 && <p>Пропущено: {importResult.stats.skipped}</p>}
                  {importResult.stats.errors > 0 && <p className="text-red-600">Ошибок: {importResult.stats.errors}</p>}
                </div>
              </div>
              <button
                onClick={() => setImportResult(null)}
                className="ml-3 text-green-400 hover:text-green-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
              <button
                onClick={() => setError('')}
                className="ml-3 text-red-400 hover:text-red-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Фильтры и поиск */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Поиск */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Поиск по коду, адресу или описанию..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Фильтр по статусу */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as NodeStatus | '')}
                className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">Все</option>
                <option value="existing">Существующий</option>
                <option value="planned">Проектируемый</option>
              </select>
            </div>

            {/* Фильтр по типу узла */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип узла</label>
              <select
                value={selectedNodeType}
                onChange={(e) => setSelectedNodeType(e.target.value as NodeType | '')}
                className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">Все</option>
                <option value="prp">ПРП (узел связи)</option>
                <option value="ao">АО (абонентское окончание)</option>
                <option value="sk">СК (СКУД)</option>
                <option value="other">Другое (РТК и др.)</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSearch}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Применить фильтры
            </button>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Сбросить
            </button>
          </div>
        </div>

        {/* Таблица */}
        {nodes.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет узлов</h3>
            <p className="text-gray-600 mb-4">Импортируйте узлы из Excel файла</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Импорт из Excel
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">№</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Код</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Адрес</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Местоположение</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ком.инфо</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата создания</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {nodes.map((node, index) => (
                    <tr
                      key={node.id}
                      onClick={() => openNodeModal(node)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{node.code}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{nodeTypeLabels[node.node_type]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 max-w-xs" title={node.address}>
                          {node.address}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 max-w-xs truncate" title={node.location_details || ''}>
                          {node.location_details || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 max-w-xs truncate" title={node.comm_info || ''}>
                          {node.comm_info || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${statusColors[node.status]}`}>
                          {statusLabels[node.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {node.node_created_date ? new Date(node.node_created_date).toLocaleDateString('ru-RU') : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Пагинация */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Назад
                    </button>
                    <button
                      onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Вперёд
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Показано <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> -
                        <span className="font-medium"> {Math.min(pagination.page * pagination.limit, pagination.total)}</span> из
                        <span className="font-medium"> {pagination.total}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                          disabled={pagination.page === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Назад</span>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          {pagination.page} / {pagination.totalPages}
                        </span>
                        <button
                          onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                          disabled={pagination.page === pagination.totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Вперёд</span>
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Модальное окно */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75" onClick={closeNodeModal}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    {isEditing ? 'Редактирование узла' : 'Информация об узле'}
                  </h3>
                  <button
                    onClick={closeNodeModal}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {isEditing ? (
                    <>
                      {/* Форма редактирования */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Код</label>
                        <input
                          type="text"
                          value={editForm.code || ''}
                          onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Тип узла</label>
                        <select
                          value={editForm.node_type || ''}
                          onChange={(e) => setEditForm({ ...editForm, node_type: e.target.value as NodeType })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                          <option value="prp">ПРП (узел связи)</option>
                          <option value="ao">АО (абонентское окончание)</option>
                          <option value="sk">СК (СКУД)</option>
                          <option value="other">Другое (РТК и др.)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Адрес</label>
                        <textarea
                          value={editForm.address || ''}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          rows={2}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Местоположение</label>
                        <textarea
                          value={editForm.location_details || ''}
                          onChange={(e) => setEditForm({ ...editForm, location_details: e.target.value })}
                          rows={2}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Коммутационная информация</label>
                        <textarea
                          value={editForm.comm_info || ''}
                          onChange={(e) => setEditForm({ ...editForm, comm_info: e.target.value })}
                          rows={2}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Статус</label>
                        <select
                          value={editForm.status || ''}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value as NodeStatus })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                          <option value="existing">Существующий</option>
                          <option value="planned">Проектируемый</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Ссылка на договор</label>
                        <input
                          type="text"
                          value={editForm.contract_link || ''}
                          onChange={(e) => setEditForm({ ...editForm, contract_link: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Дата создания узла</label>
                        <input
                          type="date"
                          value={editForm.node_created_date || ''}
                          onChange={(e) => setEditForm({ ...editForm, node_created_date: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Просмотр */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Код</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedNode.code}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Тип узла</label>
                          <p className="mt-1 text-sm text-gray-900">{nodeTypeLabels[selectedNode.node_type]}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Адрес</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedNode.address}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Местоположение</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedNode.location_details || '—'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Коммутационная информация</label>
                        <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{selectedNode.comm_info || '—'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Статус</label>
                          <p className="mt-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${statusColors[selectedNode.status]}`}>
                              {statusLabels[selectedNode.status]}
                            </span>
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Дата создания</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {selectedNode.node_created_date ? new Date(selectedNode.node_created_date).toLocaleDateString('ru-RU') : '—'}
                          </p>
                        </div>
                      </div>
                      {selectedNode.contract_link && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Договор</label>
                          <p className="mt-1 text-sm text-indigo-600 hover:text-indigo-500">
                            <a href={selectedNode.contract_link} target="_blank" rel="noopener noreferrer">
                              {selectedNode.contract_link}
                            </a>
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-row-reverse gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveNode}
                      disabled={isSaving}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false)
                        setEditForm(selectedNode)
                      }}
                      disabled={isSaving}
                      className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <>
                    {userRole === 'admin' && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Редактировать
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={closeNodeModal}
                      className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Закрыть
                    </button>
                  </>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
