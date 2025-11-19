'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface Address {
  id: string
  street: string
  house: string
  comment: string | null
  total_applications: number
  status_counts: Record<string, number>
  applications: Array<{
    id: string
    status: string
    application_number: number
  }>
}

type SortField = 'address' | 'total' | string
type SortDirection = 'asc' | 'desc'

const statusLabelsDefault: Record<string, string> = {
  new: 'Новая',
  thinking: 'Думает',
  estimation: 'Расчёт',
  waiting_payment: 'Ожидание оплаты',
  contract: 'Договор',
  queue_install: 'Очередь на монтаж',
  install: 'Монтаж',
  installed: 'Выполнено',
  rejected: 'Отказ',
  no_tech: 'Нет тех. возможности',
}

const statusColors: Record<string, string> = {
  new: 'bg-gray-100 text-gray-800',
  thinking: 'bg-blue-100 text-blue-800',
  estimation: 'bg-indigo-100 text-indigo-800',
  waiting_payment: 'bg-amber-100 text-amber-800',
  contract: 'bg-cyan-100 text-cyan-800',
  queue_install: 'bg-purple-100 text-purple-800',
  install: 'bg-violet-100 text-violet-800',
  installed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  no_tech: 'bg-orange-100 text-orange-800',
}

export default function NodesPage() {
  const router = useRouter()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>(statusLabelsDefault)

  // Фильтры и поиск
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [sortField, setSortField] = useState<SortField>('address')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  useEffect(() => {
    loadStatuses()
    loadAddresses()
  }, [])

  async function loadStatuses() {
    try {
      const response = await fetch('/api/statuses')
      if (!response.ok) {
        throw new Error('Failed to load statuses')
      }
      const data = await response.json()
      const labels: Record<string, string> = {}
      data.statuses.forEach((status: { code: string; name_ru: string }) => {
        labels[status.code] = status.name_ru
      })
      setStatusLabels(labels)
    } catch (error) {
      console.error('Error loading statuses:', error)
      setStatusLabels(statusLabelsDefault)
    }
  }

  async function loadAddresses() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/addresses')

      if (!response.ok) {
        throw new Error('Failed to load addresses')
      }

      const data = await response.json()
      setAddresses(data.addresses)
    } catch (error) {
      console.error('Error loading addresses:', error)
      setError('Не удалось загрузить список узлов')
    } finally {
      setIsLoading(false)
    }
  }

  // Получаем список всех уникальных статусов
  const allStatuses = useMemo(() => {
    const statuses = new Set<string>()
    addresses.forEach(addr => {
      Object.keys(addr.status_counts).forEach(status => statuses.add(status))
    })
    return Array.from(statuses).sort()
  }, [addresses])

  // Фильтрация и сортировка
  const filteredAndSortedAddresses = useMemo(() => {
    let filtered = addresses

    // Поиск
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(addr =>
        addr.street.toLowerCase().includes(query) ||
        addr.house.toLowerCase().includes(query) ||
        (addr.comment && addr.comment.toLowerCase().includes(query))
      )
    }

    // Фильтр по статусам
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(addr =>
        selectedStatuses.some(status => addr.status_counts[status] > 0)
      )
    }

    // Сортировка
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      if (sortField === 'address') {
        aValue = `${a.street} ${a.house}`
        bValue = `${b.street} ${b.house}`
      } else if (sortField === 'total') {
        aValue = a.total_applications
        bValue = b.total_applications
      } else {
        // Сортировка по конкретному статусу
        aValue = a.status_counts[sortField] || 0
        bValue = b.status_counts[sortField] || 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue, 'ru')
          : bValue.localeCompare(aValue, 'ru')
      } else {
        return sortDirection === 'asc'
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number)
      }
    })

    return sorted
  }, [addresses, searchQuery, selectedStatuses, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const toggleStatusFilter = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
          </div>
        </div>
      </div>
    )
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
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
            <div className="text-sm text-gray-600">
              Показано: <span className="font-semibold">{filteredAndSortedAddresses.length}</span> из <span className="font-semibold">{addresses.length}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Фильтры и поиск */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          {/* Поиск */}
          <div className="mb-4">
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
                placeholder="Поиск по адресу или комментарию..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Фильтры по статусам */}
          {allStatuses.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-700">Фильтр по статусам:</span>
                {selectedStatuses.length > 0 && (
                  <button
                    onClick={() => setSelectedStatuses([])}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Сбросить
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allStatuses.map(status => (
                  <button
                    key={status}
                    onClick={() => toggleStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedStatuses.includes(status)
                        ? statusColors[status] || 'bg-gray-200 text-gray-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {statusLabels[status] || status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Таблица */}
        {filteredAndSortedAddresses.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {addresses.length === 0 ? 'Нет узлов' : 'Нет результатов'}
            </h3>
            <p className="text-gray-600">
              {addresses.length === 0
                ? 'Список узлов подключения пуст'
                : 'Попробуйте изменить параметры поиска или фильтры'
              }
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => handleSort('address')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Адрес
                        <SortIcon field="address" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Комментарий
                    </th>
                    <th
                      onClick={() => handleSort('total')}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center justify-center gap-1">
                        Всего
                        <SortIcon field="total" />
                      </div>
                    </th>
                    {allStatuses.map(status => (
                      <th
                        key={status}
                        onClick={() => handleSort(status)}
                        className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="truncate max-w-[100px]" title={statusLabels[status] || status}>
                            {statusLabels[status] || status}
                          </span>
                          <SortIcon field={status} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedAddresses.map((address) => (
                    <tr key={address.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {address.street}, {address.house}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 max-w-xs truncate" title={address.comment || ''}>
                          {address.comment || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className="text-sm font-bold text-gray-900">
                          {address.total_applications}
                        </span>
                      </td>
                      {allStatuses.map(status => {
                        const count = address.status_counts[status] || 0
                        return (
                          <td key={status} className="px-3 py-3 whitespace-nowrap text-center">
                            {count > 0 ? (
                              <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-md text-xs font-semibold ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
                                {count}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
