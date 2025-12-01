'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth-client'

interface Address {
  id: string
  city: string
  street: string
  house: string | null
  building: string | null
  address: string
  comment: string | null
  node_count: number
  presence_types: {
    has_node: number
    has_ao: number
    has_transit_cable: number
    not_present: number
  }
  presence_status: string
  created_at: string
}

interface Node {
  id: string
  code: string
  node_type: string
  presence_type: string
  status: string
}

interface AddressesResponse {
  data: Address[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const presenceLabels: Record<string, string> = {
  has_node: 'Есть узел',
  has_ao: 'Есть АО',
  has_transit_cable: 'Транзитный кабель',
  not_present: 'Не присутствуем',
}

const presenceColors: Record<string, string> = {
  has_node: 'bg-green-100 text-green-800',
  has_ao: 'bg-blue-100 text-blue-800',
  has_transit_cable: 'bg-yellow-100 text-yellow-800',
  not_present: 'bg-gray-100 text-gray-800',
}

export default function AddressesPage() {
  const router = useRouter()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })

  // Фильтры и поиск
  const [searchQuery, setSearchQuery] = useState('')

  // Сортировка
  const [sortField, setSortField] = useState<string>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Выбранный адрес для просмотра деталей
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Режим редактирования
  const [isEditMode, setIsEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState<Partial<Address>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Узлы на адресе
  const [addressNodes, setAddressNodes] = useState<Node[]>([])
  const [isLoadingNodes, setIsLoadingNodes] = useState(false)

  useEffect(() => {
    // Загружаем сортировку из localStorage
    const savedSort = localStorage.getItem('addresses-sort')
    if (savedSort) {
      try {
        const { field, direction } = JSON.parse(savedSort)
        setSortField(field)
        setSortDirection(direction)
      } catch (e) {
        console.error('Failed to parse saved sort', e)
      }
    }

    void loadAddresses()
    void loadCurrentUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Автоприменение фильтров
  useEffect(() => {
    if (addresses.length > 0 || !isLoading) {
      void loadAddresses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDirection])

  // Закрытие модального окна по Esc
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

  async function loadAddressNodes(addressId: string) {
    setIsLoadingNodes(true)
    try {
      const response = await fetch(`/api/nodes?address_id=${addressId}&limit=1000`)
      if (!response.ok) {
        throw new Error('Failed to load nodes')
      }
      const data = await response.json()
      setAddressNodes(data.data || [])
    } catch (error) {
      console.error('Error loading nodes:', error)
      setAddressNodes([])
    } finally {
      setIsLoadingNodes(false)
    }
  }

  async function loadAddresses() {
    setIsLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort_field: sortField,
        sort_direction: sortDirection,
      })

      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/addresses?${params}`)

      if (!response.ok) {
        throw new Error('Failed to load addresses')
      }

      const data: AddressesResponse = await response.json()
      setAddresses(data.data)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error loading addresses:', error)
      setError('Не удалось загрузить список адресов')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSort(field: string) {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortField(field)
    setSortDirection(newDirection)

    // Сохраняем в localStorage
    localStorage.setItem('addresses-sort', JSON.stringify({ field, direction: newDirection }))
  }

  function handleSearch() {
    loadAddresses()
  }

  function handleClearFilters() {
    setSearchQuery('')
    // loadAddresses будет вызван автоматически через useEffect
  }

  function handleAddressClick(address: Address) {
    setSelectedAddress(address)
    setEditFormData(address)
    setIsEditMode(false)
    setIsModalOpen(true)
    void loadAddressNodes(address.id)
  }

  function handleCloseModal() {
    setIsModalOpen(false)
    setSelectedAddress(null)
    setIsEditMode(false)
    setEditFormData({})
    setAddressNodes([])
  }

  function handleEditToggle() {
    setIsEditMode(!isEditMode)
    if (!isEditMode && selectedAddress) {
      setEditFormData(selectedAddress)
    }
  }

  async function handleSaveAddress() {
    if (!selectedAddress || !editFormData) return

    setIsSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/addresses/${selectedAddress.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update address')
      }

      // Перезагружаем список адресов, чтобы получить актуальные данные
      await loadAddresses()

      // Закрываем модальное окно
      handleCloseModal()
    } catch (err) {
      console.error('Error saving address:', err)
      setError(`Ошибка сохранения: ${err}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && addresses.length === 0) {
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
                Всего адресов: <span className="font-semibold">{pagination.total}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  placeholder="Поиск по городу, улице, дому..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSearch}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Поиск
            </button>
            {searchQuery && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Сбросить
              </button>
            )}
          </div>
        </div>

        {/* Таблица */}
        {addresses.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Нет адресов</h3>
            <p className="text-gray-600">Адреса будут добавлены автоматически при создании узлов</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">№</th>
                    <th
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('address')}
                    >
                      <div className="flex items-center gap-1">
                        Адрес
                        {sortField === 'address' && (
                          <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Узлов
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Присутствие
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Детали
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {addresses.map((address, index) => (
                    <tr
                      key={address.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleAddressClick(address)}
                    >
                      <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-500">
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-900">{address.address}</div>
                        {address.comment && (
                          <div className="text-xs text-gray-500 mt-1">{address.comment}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                          {address.node_count}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${presenceColors[address.presence_status]}`}>
                          {presenceLabels[address.presence_status]}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <div className="text-xs text-gray-600 space-y-1">
                          {address.presence_types.has_node > 0 && (
                            <div>Узлов: {address.presence_types.has_node}</div>
                          )}
                          {address.presence_types.has_ao > 0 && (
                            <div>АО: {address.presence_types.has_ao}</div>
                          )}
                          {address.presence_types.has_transit_cable > 0 && (
                            <div>Транзит: {address.presence_types.has_transit_cable}</div>
                          )}
                          {address.presence_types.not_present > 0 && (
                            <div>Не прис.: {address.presence_types.not_present}</div>
                          )}
                        </div>
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

        {/* Модальное окно просмотра/редактирования адреса */}
        {isModalOpen && selectedAddress && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isEditMode) {
                handleCloseModal()
              }
            }}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {isEditMode ? 'Редактирование адреса' : 'Информация об адресе'}
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Полный адрес</label>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={editFormData.address || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{selectedAddress.address}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editFormData.city || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedAddress.city}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Улица</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editFormData.street || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, street: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedAddress.street}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Дом</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editFormData.house || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, house: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedAddress.house || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Корпус</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={editFormData.building || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, building: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedAddress.building || '—'}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
                    {isEditMode ? (
                      <textarea
                        value={editFormData.comment || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, comment: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{selectedAddress.comment || '—'}</p>
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Статистика по узлам</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-indigo-50 rounded-lg p-3">
                        <div className="text-xs text-indigo-600 font-medium">Всего узлов</div>
                        <div className="text-2xl font-bold text-indigo-900">{selectedAddress.node_count}</div>
                      </div>

                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="text-xs text-green-600 font-medium">Узлы связи</div>
                        <div className="text-2xl font-bold text-green-900">{selectedAddress.presence_types.has_node}</div>
                      </div>

                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-xs text-blue-600 font-medium">АО</div>
                        <div className="text-2xl font-bold text-blue-900">{selectedAddress.presence_types.has_ao}</div>
                      </div>

                      <div className="bg-yellow-50 rounded-lg p-3">
                        <div className="text-xs text-yellow-600 font-medium">Транзитный кабель</div>
                        <div className="text-2xl font-bold text-yellow-900">{selectedAddress.presence_types.has_transit_cable}</div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                        <div className="text-xs text-gray-600 font-medium">Не присутствуем</div>
                        <div className="text-2xl font-bold text-gray-900">{selectedAddress.presence_types.not_present}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Общий статус присутствия</label>
                    <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${presenceColors[selectedAddress.presence_status]}`}>
                      {presenceLabels[selectedAddress.presence_status]}
                    </span>
                  </div>

                  {/* Список узлов */}
                  {!isEditMode && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Узлы на адресе ({addressNodes.length})
                      </h4>
                      {isLoadingNodes ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        </div>
                      ) : addressNodes.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">Нет узлов на этом адресе</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {addressNodes.map((node) => (
                            <button
                              key={node.id}
                              onClick={() => router.push(`/dashboard/nodes?node_id=${node.id}`)}
                              className="w-full text-left px-3 py-2 border border-gray-200 rounded-md hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium text-gray-900">{node.code}</span>
                                  <span className="text-xs text-gray-500 ml-2">
                                    {node.node_type === 'prp' ? 'ПРП' :
                                     node.node_type === 'ao' ? 'АО' :
                                     node.node_type === 'sk' ? 'СК' : 'Др.'}
                                  </span>
                                </div>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                      onClick={handleSaveAddress}
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
      </main>
    </div>
  )
}
