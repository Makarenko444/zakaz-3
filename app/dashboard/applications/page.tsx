'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Application, ApplicationStatus, Urgency, ServiceType, CustomerType } from '@/lib/types'

// Расширенный тип для заявки с адресом
interface ApplicationWithAddress extends Application {
  zakaz_addresses: {
    street: string
    house: string
    entrance: string | null
  } | null
}

// Тип для статуса из БД
interface StatusFromDB {
  id: string
  code: string
  name_ru: string
  description_ru: string | null
  sort_order: number
  is_active: boolean
}

// Цвета статусов (согласно ТЗ)
const statusColors: Record<ApplicationStatus, string> = {
  new: 'bg-gray-100 text-gray-800',
  thinking: 'bg-blue-100 text-blue-800',
  estimation: 'bg-indigo-100 text-indigo-800',
  contract: 'bg-cyan-100 text-cyan-800',
  design: 'bg-teal-100 text-teal-800',
  approval: 'bg-emerald-100 text-emerald-800',
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

function ApplicationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [applications, setApplications] = useState<ApplicationWithAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Статусы из БД
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({})
  const [statusesLoaded, setStatusesLoaded] = useState(false)

  // Фильтры
  const [selectedStatuses, setSelectedStatuses] = useState<ApplicationStatus[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUrgency, setSelectedUrgency] = useState<Urgency | ''>('')
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | ''>('')
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [addressInfo, setAddressInfo] = useState<{ street: string; house: string } | null>(null)
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('')

  // Список пользователей для фильтра
  const [users, setUsers] = useState<{ id: string; full_name: string; role: string }[]>([])

  // Загрузка pageSize из localStorage при монтировании
  useEffect(() => {
    const savedPageSize = localStorage.getItem('applicationsPageSize')
    if (savedPageSize) {
      setPageSize(parseInt(savedPageSize))
    }
  }, [])

  // Сохранение pageSize в localStorage при изменении
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setPage(1) // Сброс на первую страницу
    localStorage.setItem('applicationsPageSize', newSize.toString())
  }

  const loadApplications = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
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

      if (selectedAddressId) {
        params.append('address_id', selectedAddressId)
      }

      if (selectedAssignedTo) {
        params.append('assigned_to', selectedAssignedTo)
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
  }, [page, pageSize, selectedStatuses, searchQuery, selectedUrgency, selectedServiceType, selectedAddressId, selectedAssignedTo])

  // Инициализация фильтра по адресу из URL при монтировании
  useEffect(() => {
    const addressId = searchParams.get('address_id')
    const addressStreet = searchParams.get('address_street')
    const addressHouse = searchParams.get('address_house')

    if (addressId) {
      setSelectedAddressId(addressId)
      if (addressStreet && addressHouse) {
        setAddressInfo({ street: addressStreet, house: addressHouse })
      }
    }
  }, [searchParams])

  // Загрузка статусов и пользователей из БД при монтировании
  useEffect(() => {
    loadStatuses()
    loadUsers()
  }, [])

  useEffect(() => {
    if (statusesLoaded) {
      loadApplications()
    }
  }, [statusesLoaded, loadApplications])

  async function loadStatuses() {
    try {
      const response = await fetch('/api/statuses')
      if (!response.ok) {
        throw new Error('Failed to load statuses')
      }
      const data = await response.json()
      const labels: Record<string, string> = {}
      data.statuses.forEach((status: StatusFromDB) => {
        labels[status.code] = status.name_ru
      })
      setStatusLabels(labels)
      setStatusesLoaded(true)
    } catch (error) {
      console.error('Error loading statuses:', error)
      // Используем fallback значения при ошибке
      setStatusLabels({
        new: 'Новая',
        thinking: 'Думает',
        estimation: 'Расчёт',
        contract: 'Договор и оплата',
        design: 'Проектирование',
        approval: 'Согласование',
        queue_install: 'Очередь на монтаж',
        install: 'Монтаж',
        installed: 'Выполнено',
        rejected: 'Отказ',
        no_tech: 'Нет тех. возможности',
      })
      setStatusesLoaded(true)
    }
  }

  async function loadUsers() {
    try {
      const response = await fetch('/api/users')
      if (!response.ok) {
        throw new Error('Failed to load users')
      }
      const data = await response.json()
      // Фильтруем только пользователей, которые могут быть назначены на заявки
      // (manager, admin - это менеджеры)
      const managers = data.users.filter((user: { role: string }) =>
        ['admin', 'manager'].includes(user.role)
      )
      setUsers(managers)
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

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
    loadApplications()
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

  const formatTitle = (app: ApplicationWithAddress) => {
    const baseAddress = app.zakaz_addresses
      ? `${app.zakaz_addresses.street} ${app.zakaz_addresses.house}`
      : 'Адрес не указан'

    const details = app.address_details ? `. ${app.address_details}` : ''
    return `№${app.application_number}. ${baseAddress}${details}`
  }

  return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Все заявки</h1>
            <span className="text-sm text-gray-500">({total})</span>
          </div>

          <button
            onClick={() => router.push('/dashboard/applications/new')}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать заявку
          </button>
        </div>

        {/* Фильтр по адресу */}
        {addressInfo && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-blue-900">
                <span className="font-medium">Фильтр по адресу:</span> {addressInfo.street}, {addressInfo.house}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedAddressId('')
                setAddressInfo(null)
                router.push('/dashboard/applications')
              }}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
            >
              Сбросить
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Поиск */}
        <div className="mb-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Поиск по ФИО, телефону или адресу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              Найти
            </button>
            {(searchQuery || selectedStatuses.length > 0 || selectedUrgency || selectedServiceType || selectedAssignedTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedStatuses([])
                  setSelectedUrgency('')
                  setSelectedServiceType('')
                  setSelectedAssignedTo('')
                  setPage(1)
                }}
                className="px-4 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Сбросить
              </button>
            )}
          </form>
        </div>

        {/* Фильтры по статусам */}
        <div className="mb-3 bg-white rounded-lg border border-gray-200 p-3">
          <h3 className="text-xs font-medium text-gray-700 mb-2">Фильтр по статусам:</h3>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(statusLabels) as ApplicationStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full transition ${
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
        <div className="mb-3 bg-white rounded-lg border border-gray-200 p-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Срочность:</label>
              <select
                value={selectedUrgency}
                onChange={(e) => {
                  setSelectedUrgency(e.target.value as Urgency | '')
                  setPage(1)
                }}
                className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Тип услуги:</label>
              <select
                value={selectedServiceType}
                onChange={(e) => {
                  setSelectedServiceType(e.target.value as ServiceType | '')
                  setPage(1)
                }}
                className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Все</option>
                {(Object.keys(serviceTypeLabels) as ServiceType[]).map((type) => (
                  <option key={type} value={type}>
                    {serviceTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Назначено:</label>
              <select
                value={selectedAssignedTo}
                onChange={(e) => {
                  setSelectedAssignedTo(e.target.value)
                  setPage(1)
                }}
                className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Все</option>
                <option value="unassigned">Без менеджера</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Список заявок */}
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-base font-medium text-gray-900 mb-1">Заявки не найдены</h3>
            <p className="text-sm text-gray-500">Попробуйте изменить фильтры или создайте новую заявку</p>
          </div>
        ) : (
          <div className="space-y-2">
            {applications.map((app) => (
              <div
                key={app.id}
                onClick={() => router.push(`/dashboard/applications/${app.id}`)}
                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition cursor-pointer"
              >
                {/* Первая строка: Заголовок, статусы слева, дата справа */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {formatTitle(app)}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${statusColors[app.status]}`}>
                      {statusLabels[app.status]}
                    </span>
                    <span className={`text-xs font-medium whitespace-nowrap ${urgencyColors[app.urgency]}`}>
                      {urgencyLabels[app.urgency]}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(app.created_at)}</span>
                </div>

                {/* Вторая строка: Клиент и тип услуги */}
                <div className="mb-1">
                  <p className="text-sm font-medium text-gray-900">{app.customer_fullname}</p>
                  <p className="text-xs text-gray-500">
                    {customerTypeLabels[app.customer_type]} • {serviceTypeLabels[app.service_type]}
                  </p>
                </div>

                {/* Комментарий */}
                {app.client_comment && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">Комментарий:</p>
                    <p className="text-xs text-gray-700 line-clamp-2">{app.client_comment}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Пагинация и настройки */}
        {!isLoading && total > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
            {/* Выбор количества на странице */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Показывать:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-500">из {total}</span>
            </div>

            {/* Пагинация */}
            {total > pageSize && (
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Назад
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-700">
                  Страница {page} из {Math.ceil(total / pageSize)}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Вперёд
                </button>
              </div>
            )}
          </div>
        )}
      </main>
  )
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </main>
    }>
      <ApplicationsContent />
    </Suspense>
  )
}
