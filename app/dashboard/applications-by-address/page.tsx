'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Pagination from '@/app/components/Pagination'

interface AddressStats {
  address_id: string
  address: string
  city: string | null
  street: string | null
  house: string | null
  building: string | null
  total_applications: number
  active_count: number
  completed_count: number
  by_status: {
    status: string
    status_name: string
    count: number
  }[]
}

type FilterType = 'all' | 'active' | 'completed'
type SortField = 'address' | 'total_applications' | 'active_count' | 'completed_count'
type SortDirection = 'asc' | 'desc'

const DEFAULT_ITEMS_PER_PAGE = 20

export default function ApplicationsByAddressPage() {
  const router = useRouter()
  const [addressesStats, setAddressesStats] = useState<AddressStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('total_applications')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE)

  useEffect(() => {
    loadAddressesStats()
  }, [])

  async function loadAddressesStats() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/statistics/applications-by-address')
      if (!response.ok) throw new Error('Failed to load statistics')
      const data = await response.json()
      setAddressesStats(data)
    } catch (error) {
      console.error('Error loading statistics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Фильтрация и сортировка
  const processedAddresses = useMemo(() => {
    let result = [...addressesStats]

    // Фильтр по статусу
    if (filter === 'active') {
      result = result.filter(addr => addr.active_count > 0)
    } else if (filter === 'completed') {
      result = result.filter(addr => addr.completed_count > 0)
    }

    // Поиск по адресу
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(addr => addr.address.toLowerCase().includes(query))
    }

    // Сортировка
    result.sort((a, b) => {
      let comparison = 0
      if (sortField === 'address') {
        comparison = a.address.localeCompare(b.address, 'ru')
      } else {
        comparison = a[sortField] - b[sortField]
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [addressesStats, filter, searchQuery, sortField, sortDirection])

  // Пагинация
  const totalPages = Math.ceil(processedAddresses.length / itemsPerPage)
  const paginatedAddresses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return processedAddresses.slice(start, start + itemsPerPage)
  }, [processedAddresses, currentPage, itemsPerPage])

  // Сброс страницы при изменении фильтров или количества на странице
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, searchQuery, sortField, sortDirection, itemsPerPage])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'address' ? 'asc' : 'desc')
    }
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

  const filterButtons: { value: FilterType; label: string }[] = [
    { value: 'active', label: 'Активные' },
    { value: 'all', label: 'Все' },
    { value: 'completed', label: 'Завершенные' },
  ]

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Заявки по адресам</h1>
          <p className="text-sm text-gray-600 mt-1">
            Статистика заявок по адресам с разбивкой по статусам
          </p>
        </div>
        <button
          onClick={loadAddressesStats}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
        >
          Обновить
        </button>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Фильтр по статусу заявок */}
          <div className="flex gap-2">
            {filterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setFilter(btn.value)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === btn.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Поиск */}
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по адресу..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Пагинация сверху */}
        {!isLoading && processedAddresses.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={processedAddresses.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка статистики...</p>
          </div>
        ) : paginatedAddresses.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
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
            <p className="text-gray-600">
              {searchQuery ? 'Адреса не найдены' : 'Нет данных для отображения'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                    onClick={() => handleSort('address')}
                  >
                    <div className="flex items-center gap-2">
                      Адрес
                      <SortIcon field="address" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                    onClick={() => handleSort('total_applications')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Всего
                      <SortIcon field="total_applications" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                    onClick={() => handleSort('active_count')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Активных
                      <SortIcon field="active_count" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                    onClick={() => handleSort('completed_count')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Завершенных
                      <SortIcon field="completed_count" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    По статусам
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedAddresses.map((addr) => (
                  <tr key={addr.address_id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">{addr.address}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {addr.total_applications}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {addr.active_count}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        {addr.completed_count}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {addr.by_status.map((stat) => (
                          <button
                            key={stat.status}
                            onClick={() =>
                              router.push(
                                `/dashboard/applications?address_id=${addr.address_id}&address=${encodeURIComponent(
                                  addr.address
                                )}&status=${stat.status}`
                              )
                            }
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-indigo-100 hover:text-indigo-700 transition cursor-pointer"
                            title={`${stat.status_name}: показать ${stat.count} заявок`}
                          >
                            {stat.status_name}: {stat.count}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/applications?address_id=${addr.address_id}&address=${encodeURIComponent(
                              addr.address
                            )}`
                          )
                        }
                        className="text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                      >
                        Показать заявки
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Пагинация снизу */}
        {!isLoading && processedAddresses.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={processedAddresses.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </div>
        )}
      </div>

      {/* Итоговая информация */}
      {!isLoading && processedAddresses.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-600">
            Всего адресов: <span className="font-semibold">{processedAddresses.length}</span>
            {filter !== 'all' && (
              <> (из <span className="font-semibold">{addressesStats.length}</span>)</>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
