'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Node, NodeStatus, NodeType, User } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth-client'

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

  // Импорт
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Фильтры и поиск
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<NodeStatus | ''>('')
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | ''>('')

  // Модальное окно и редактирование
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editFormData, setEditFormData] = useState<Partial<Node>>({})

  // Создание нового узла
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createFormData, setCreateFormData] = useState<Partial<Node>>({
    city: 'Томск',
    node_type: 'prp',
    status: 'existing'
  })
  const [osmValidation, setOsmValidation] = useState<{
    status: 'match' | 'suggestions' | 'no_match'
    message: string
    suggestion?: string
    suggestions?: string[]
  } | null>(null)
  const [isValidatingOsm, setIsValidatingOsm] = useState(false)

  useEffect(() => {
    void loadNodes()
    void loadCurrentUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Закрытие модального окна по Esc (только в режиме просмотра)
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isModalOpen && !isEditMode) {
        handleCloseModal()
      }
    }

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isModalOpen, isEditMode])

  async function loadCurrentUser() {
    const user = await getCurrentUser()
    setCurrentUser(user)
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

  function handleNodeClick(node: Node) {
    setSelectedNode(node)
    setEditFormData(node)
    setIsEditMode(false)
    setIsModalOpen(true)
  }

  function handleCloseModal() {
    setIsModalOpen(false)
    setSelectedNode(null)
    setIsEditMode(false)
    setEditFormData({})
  }

  function handleEditToggle() {
    setIsEditMode(!isEditMode)
    if (!isEditMode && selectedNode) {
      setEditFormData(selectedNode)
    }
  }

  async function handleSaveNode() {
    if (!selectedNode || !editFormData) return

    setIsSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/nodes/${selectedNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update node')
      }

      const updatedNode = await response.json()

      // Обновляем список узлов
      setNodes(nodes.map(n => n.id === updatedNode.id ? updatedNode : n))

      // Закрываем модальное окно
      handleCloseModal()
    } catch (err) {
      console.error('Error saving node:', err)
      setError(`Ошибка сохранения: ${err}`)
    } finally {
      setIsSaving(false)
    }
  }

  function handleOpenCreateModal() {
    setCreateFormData({
      city: 'Томск',
      node_type: 'prp',
      status: 'existing'
    })
    setIsCreateModalOpen(true)
  }

  function handleCloseCreateModal() {
    setIsCreateModalOpen(false)
    setCreateFormData({
      city: 'Томск',
      node_type: 'prp',
      status: 'existing'
    })
    setOsmValidation(null)
  }

  async function validateAddressFormat() {
    if (!createFormData.street) {
      setOsmValidation(null)
      return
    }

    setIsValidatingOsm(true)
    try {
      const addressToValidate = createFormData.house
        ? `${createFormData.street}, ${createFormData.house}`
        : createFormData.street

      const city = createFormData.city || 'Томск'
      const fullAddress = `${city}, ${addressToValidate}`

      const response = await fetch(`/api/addresses/validate-osm?address=${encodeURIComponent(fullAddress)}`)
      const data = await response.json()
      setOsmValidation(data)
    } catch (error) {
      console.error('Error validating address with OSM:', error)
      setOsmValidation({
        status: 'no_match',
        message: 'Не удалось проверить адрес'
      })
    } finally {
      setIsValidatingOsm(false)
    }
  }

  function applyOsmSuggestion(suggestion: string) {
    // Парсим предложение формата "улица, дом"
    const parts = suggestion.split(',').map(p => p.trim())
    if (parts.length >= 2) {
      setCreateFormData({
        ...createFormData,
        street: parts[0],
        house: parts[1]
      })
      setOsmValidation(null)
    }
  }

  async function handleCreateNode() {
    setIsSaving(true)
    setError('')

    try {
      // Проверка обязательных полей
      if (!createFormData.code || !createFormData.street) {
        setError('Код и улица обязательны для заполнения')
        setIsSaving(false)
        return
      }

      const response = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createFormData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create node')
      }

      // Перезагружаем список узлов
      await loadNodes()

      // Закрываем модальное окно
      handleCloseCreateModal()
    } catch (err) {
      console.error('Error creating node:', err)
      setError(`Ошибка создания узла: ${err}`)
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
              <h1 className="text-2xl font-bold text-gray-900">Адреса</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Всего: <span className="font-semibold">{pagination.total}</span>
              </div>
              {currentUser?.role === 'admin' && (
                <button
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Создать адрес
                </button>
              )}
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
                {importResult.details?.skipped && importResult.details.skipped.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-green-800 hover:text-green-900">
                      Показать пропущенные строки
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      {importResult.details.skipped.map((item, idx) => (
                        <div key={idx} className="text-xs text-gray-600 py-1">
                          Строка {item.row}: {item.reason}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
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
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">№</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Код</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Адрес</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">Местоположение</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Дата</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {nodes.map((node, index) => (
                    <tr
                      key={node.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleNodeClick(node)}
                    >
                      <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{node.code}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-600">
                          {node.node_type === 'prp' ? 'ПРП' :
                           node.node_type === 'ao' ? 'АО' :
                           node.node_type === 'sk' ? 'СК' : 'Др.'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-900 max-w-md truncate" title={node.address}>
                          {node.address}
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden xl:table-cell">
                        <div className="text-sm text-gray-600 max-w-xs truncate" title={node.location_details || ''}>
                          {node.location_details || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[node.status]}`}>
                          {node.status === 'existing' ? 'Сущ.' : 'Проект.'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">
                        <span className="text-xs text-gray-600">
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

        {/* Модальное окно просмотра/редактирования узла */}
        {isModalOpen && selectedNode && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75"
            onClick={() => !isEditMode && handleCloseModal()}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {isEditMode ? 'Редактирование узла' : 'Информация об узле'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-4">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Код</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={editFormData.code || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <p className="text-sm text-gray-900">{selectedNode.code}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Тип узла</label>
                        <p className="text-sm text-gray-900">{nodeTypeLabels[selectedNode.node_type]}</p>
                      </div>
                    </div>

                    {/* Адрес */}
                    {isEditMode ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                          <input
                            type="text"
                            value={editFormData.city || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Томск"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Улица *</label>
                            <input
                              type="text"
                              value={editFormData.street || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, street: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="проспект Ленина"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Дом</label>
                            <input
                              type="text"
                              value={editFormData.house || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, house: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="22"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Корпус/строение (необязательно)</label>
                          <input
                            type="text"
                            value={editFormData.building || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, building: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="корп. 2"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
                        <p className="text-sm text-gray-900">{selectedNode.address}</p>
                        <div className="mt-2 text-xs text-gray-600 space-y-1">
                          {selectedNode.city && <div>Город: {selectedNode.city}</div>}
                          {selectedNode.street && <div>Улица: {selectedNode.street}</div>}
                          {selectedNode.house && <div>Дом: {selectedNode.house}</div>}
                          {selectedNode.building && <div>Корпус: {selectedNode.building}</div>}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Местоположение</label>
                      {isEditMode ? (
                        <textarea
                          value={editFormData.location_details || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, location_details: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedNode.location_details || '—'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Коммутационная информация</label>
                      {isEditMode ? (
                        <textarea
                          value={editFormData.comm_info || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, comm_info: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedNode.comm_info || '—'}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                        {isEditMode ? (
                          <select
                            value={editFormData.status || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as NodeStatus })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="existing">Существующий</option>
                            <option value="planned">Проектируемый</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${statusColors[selectedNode.status]}`}>
                            {statusLabels[selectedNode.status]}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Дата создания</label>
                        {isEditMode ? (
                          <input
                            type="date"
                            value={editFormData.node_created_date || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, node_created_date: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <p className="text-sm text-gray-900">
                            {selectedNode.node_created_date ? new Date(selectedNode.node_created_date).toLocaleDateString('ru-RU') : '—'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ссылка на договор</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editFormData.contract_link || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, contract_link: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedNode.contract_link || '—'}</p>
                      )}
                    </div>
                  </div>
                </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-3 flex justify-end gap-2">
                {isEditMode ? (
                  <>
                    <button
                      type="button"
                      onClick={handleEditToggle}
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNode}
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isSaving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Закрыть
                    </button>
                    {currentUser?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={handleEditToggle}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                      >
                        Редактировать
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Модальное окно создания узла */}
        {isCreateModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75"
            onClick={handleCloseCreateModal}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Создание нового адреса</h3>
                <button
                  onClick={handleCloseCreateModal}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Код <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={createFormData.code || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="ПРП-001"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                      <select
                        value={createFormData.status || 'existing'}
                        onChange={(e) => setCreateFormData({ ...createFormData, status: e.target.value as NodeStatus })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="existing">Существующий</option>
                        <option value="planned">Проектируемый</option>
                      </select>
                    </div>
                  </div>

                  {/* Адрес */}
                  <div className="space-y-3 border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-700">Адрес</h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                      <input
                        type="text"
                        value={createFormData.city || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Томск"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Улица <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={createFormData.street || ''}
                          onChange={(e) => setCreateFormData({ ...createFormData, street: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="проспект Ленина"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Дом</label>
                        <input
                          type="text"
                          value={createFormData.house || ''}
                          onChange={(e) => setCreateFormData({ ...createFormData, house: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="22"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Корпус/строение
                      </label>
                      <input
                        type="text"
                        value={createFormData.building || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, building: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="корп. 2"
                      />
                    </div>

                    {/* Кнопка проверки адреса */}
                    <div>
                      <button
                        type="button"
                        onClick={validateAddressFormat}
                        disabled={isValidatingOsm || !createFormData.street}
                        className="w-full px-4 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isValidatingOsm ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Проверка адреса...
                          </>
                        ) : (
                          '🌍 Проверить формат адреса по OpenStreetMap'
                        )}
                      </button>
                    </div>

                    {/* Результаты OSM валидации */}
                    {osmValidation && (
                      <div className={`p-3 rounded-md border ${
                        osmValidation.status === 'match'
                          ? 'bg-green-50 border-green-200'
                          : osmValidation.status === 'suggestions'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}>
                        <p className={`text-sm font-medium mb-2 ${
                          osmValidation.status === 'match'
                            ? 'text-green-800'
                            : osmValidation.status === 'suggestions'
                            ? 'text-yellow-800'
                            : 'text-gray-800'
                        }`}>
                          {osmValidation.message}
                        </p>

                        {osmValidation.status === 'suggestions' && osmValidation.suggestions && (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-600">Выберите правильный вариант написания:</p>
                            {osmValidation.suggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => applyOsmSuggestion(suggestion)}
                                className="w-full text-left px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
                              >
                                📍 {suggestion}
                              </button>
                            ))}
                          </div>
                        )}

                        {osmValidation.status === 'match' && (
                          <div className="flex items-center text-sm text-green-700">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Адрес соответствует данным OSM
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Местоположение</label>
                    <textarea
                      value={createFormData.location_details || ''}
                      onChange={(e) => setCreateFormData({ ...createFormData, location_details: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Подробное описание местоположения"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Коммутационная информация</label>
                    <textarea
                      value={createFormData.comm_info || ''}
                      onChange={(e) => setCreateFormData({ ...createFormData, comm_info: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Информация о коммутации"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Дата создания</label>
                      <input
                        type="date"
                        value={createFormData.node_created_date || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, node_created_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ссылка на договор</label>
                      <input
                        type="text"
                        value={createFormData.contract_link || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, contract_link: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-1">
                    <p className="text-xs text-blue-800">
                      <strong>Тип узла</strong> будет автоматически определен по префиксу кода:
                      ПРП → узел связи, АО → абонентское окончание, СК → СКУД, другие → прочее
                    </p>
                    <p className="text-xs text-blue-800">
                      Для адресов, где еще нет присутствия, можно указать код <strong>&ldquo;Нет присутствия&rdquo;</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleCreateNode}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSaving ? 'Создание...' : 'Создать адрес'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
