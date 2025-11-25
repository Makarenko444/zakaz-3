'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AddressStats {
  node_id: string
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

export default function ApplicationsByAddressPage() {
  const router = useRouter()
  const [addressesStats, setAddressesStats] = useState<AddressStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('active')
  const [searchQuery, setSearchQuery] = useState('')

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

  // Фильтрация адресов
  const filteredAddresses = addressesStats.filter((addr) => {
    // Фильтр по статусу
    if (filter === 'active' && addr.active_count === 0) return false
    if (filter === 'completed' && addr.completed_count === 0) return false

    // Поиск по адресу
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return addr.address.toLowerCase().includes(query)
    }

    return true
  })

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
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка статистики...</p>
          </div>
        ) : filteredAddresses.length === 0 ? (
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Адрес
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Всего
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Активных
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Завершенных
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
                {filteredAddresses.map((addr) => (
                  <tr key={addr.node_id} className="hover:bg-gray-50 transition">
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
                          <span
                            key={stat.status}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                            title={stat.status_name}
                          >
                            {stat.status_name}: {stat.count}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/applications?node_id=${addr.node_id}&node_address=${encodeURIComponent(
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
      </div>

      {/* Итоговая информация */}
      {!isLoading && filteredAddresses.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-600">
            Показано адресов: <span className="font-semibold">{filteredAddresses.length}</span> из{' '}
            <span className="font-semibold">{addressesStats.length}</span>
          </p>
        </div>
      )}
    </div>
  )
}
