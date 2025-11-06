'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Application, ApplicationStatus, Urgency, ServiceType, CustomerType } from '@/lib/types'

// Расширенный тип для заявки с адресом
interface ApplicationWithAddress extends Application {
  zakaz_addresses: {
    street: string
    house: string
    entrance: string | null
  } | null
}

// Переводы статусов
const statusLabels: Record<ApplicationStatus, string> = {
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

// Цвета статусов (согласно ТЗ)
const statusColors: Record<ApplicationStatus, string> = {
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

// Цвета срочности
const urgencyColors: Record<Urgency, string> = {
  low: 'text-gray-600',
  normal: 'text-blue-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
}

const urgencyLabels: Record<Urgency, string> = {
  low: 'Низкая',
  normal: 'Обычная',
  high: 'Высокая',
  critical: 'Критическая',
}

// Типы клиентов
const customerTypeLabels: Record<CustomerType, string> = {
  individual: 'Физ. лицо',
  business: 'Юр. лицо',
}

// Типы услуг
const serviceTypeLabels: Record<ServiceType, string> = {
  apartment: 'Квартира',
  office: 'Офис',
  scs: 'СКС',
}

export default function ApplicationsPage() {
  const router = useRouter()
  const [applications, setApplications] = useState<ApplicationWithAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // Фильтры
  const [selectedStatuses, setSelectedStatuses] = useState<ApplicationStatus[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUrgency, setSelectedUrgency] = useState<Urgency | ''>('')
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | ''>('')

  const loadApplications = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (selectedStatuses.length > 0) {
        params.append('status', selectedStatuses.join(','))
      }

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      if (selectedUrgency) {
        params.append('urgency', selectedUrgency)
      }

      if (selectedServiceType) {
        params.append('service_type', selectedServiceType)
      }

      const response = await fetch(`/api/applications?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to load applications')
      }

      const data = await response.json()
      setApplications(data.applications)
      setTotal(data.total)
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [page, searchQuery, selectedServiceType, selectedStatuses, selectedUrgency])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  const toggleStatus = (status: ApplicationStatus) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter(s => s !== status))
    } else {
      setSelectedStatuses([...selectedStatuses, status])
    }
    setPage(1) // Сброс на первую страницу
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatAddress = (address: ApplicationWithAddress['zakaz_addresses']) => {
    if (!address) return 'Адрес не указан'
    const parts = [address.street, address.house]
    if (address.entrance) parts.push(`подъезд ${address.entrance}`)
    return parts.join(', ')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <h1 className="text-2xl font-bold text-gray-900">Все заявки</h1>
              <span className="text-sm text-gray-500">({total})</span>
            </div>

            <button
              onClick={() => router.push('/dashboard/applications/new')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Создать заявку
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Поиск */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <input
              type="text"
              placeholder="Поиск по ФИО или телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              Найти
            </button>
            {(searchQuery || selectedStatuses.length > 0 || selectedUrgency || selectedServiceType) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedStatuses([])
                  setSelectedUrgency('')
                  setSelectedServiceType('')
                  setPage(1)
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Сбросить
              </button>
            )}
          </form>
        </div>

        {/* Фильтры по статусам */}
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Фильтр по статусам:</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(statusLabels) as ApplicationStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                  selectedStatuses.includes(status)
                    ? statusColors[status] + ' ring-2 ring-indigo-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </div>

        {/* Дополнительные фильтры */}
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Срочность:</label>
              <select
                value={selectedUrgency}
                onChange={(e) => {
                  setSelectedUrgency(e.target.value as Urgency | '')
                  setPage(1)
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Все</option>
                {(Object.keys(urgencyLabels) as Urgency[]).map((urgency) => (
                  <option key={urgency} value={urgency}>
                    {urgencyLabels[urgency]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Тип услуги:</label>
              <select
                value={selectedServiceType}
                onChange={(e) => {
                  setSelectedServiceType(e.target.value as ServiceType | '')
                  setPage(1)
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Все</option>
                {(Object.keys(serviceTypeLabels) as ServiceType[]).map((type) => (
                  <option key={type} value={type}>
                    {serviceTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Список заявок */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Заявки не найдены</h3>
            <p className="text-gray-500">Попробуйте изменить фильтры или создайте новую заявку</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                onClick={() => router.push(`/dashboard/applications/${app.id}`)}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Заявка #{app.application_number}
                      </h3>
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusColors[app.status]}`}>
                        {statusLabels[app.status]}
                      </span>
                      <span className={`text-sm font-medium ${urgencyColors[app.urgency]}`}>
                        {urgencyLabels[app.urgency]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{formatDate(app.created_at)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Клиент:</p>
                    <p className="font-medium text-gray-900">{app.customer_fullname}</p>
                    <p className="text-sm text-gray-600">{app.customer_phone}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {customerTypeLabels[app.customer_type]} • {serviceTypeLabels[app.service_type]}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Адрес:</p>
                    <p className="font-medium text-gray-900">{formatAddress(app.zakaz_addresses)}</p>
                  </div>
                </div>

                {app.client_comment && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500">Комментарий:</p>
                    <p className="text-sm text-gray-700 line-clamp-2">{app.client_comment}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Пагинация */}
        {!isLoading && total > 20 && (
          <div className="mt-8 flex justify-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Назад
            </button>
            <span className="px-4 py-2 text-gray-700">
              Страница {page} из {Math.ceil(total / 20)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(total / 20)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Вперёд
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
