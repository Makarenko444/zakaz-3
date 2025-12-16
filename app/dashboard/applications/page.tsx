'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Application, ApplicationStatus, Urgency, ServiceType, CustomerType } from '@/lib/types'
import Pagination from '@/app/components/Pagination'

// Расширенный тип для заявки с узлом/адресом
interface ApplicationWithAddress extends Application {
  zakaz_nodes: {
    street: string | null
    house: string | null
    address: string
    presence_type: string
  } | null
  files_count?: { count: number }[]
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
  estimation_done: 'bg-sky-100 text-sky-800',
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
  emergency: 'Авария',
}

const DEFAULT_ITEMS_PER_PAGE = 20
const STORAGE_KEY_VIEW_MODE = 'applications_view_mode'
const STORAGE_KEY_ITEMS_PER_PAGE = 'applications_items_per_page'
const STORAGE_KEY_SORT = 'applications_sort'

// Тип для режима отображения
type ViewMode = 'cards' | 'table'

// Тип для сортировки
type SortField = 'application_number' | 'created_at' | 'status' | 'customer_fullname' | 'street_and_house'
type SortDirection = 'asc' | 'desc'

function ApplicationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [applications, setApplications] = useState<ApplicationWithAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // Количество элементов на странице
  const [itemsPerPage, setItemsPerPage] = useState<number>(DEFAULT_ITEMS_PER_PAGE)

  // Режим отображения
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  // Сортировка
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Флаг загрузки настроек из localStorage
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // Загружаем настройки из localStorage при монтировании
  useEffect(() => {
    // Загружаем количество элементов на странице
    const savedItemsPerPage = localStorage.getItem(STORAGE_KEY_ITEMS_PER_PAGE)
    if (savedItemsPerPage) {
      const num = parseInt(savedItemsPerPage, 10)
      if (!isNaN(num) && num > 0) {
        setItemsPerPage(num)
      }
    }

    // Загружаем режим отображения
    const savedViewMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE)
    if (savedViewMode === 'cards' || savedViewMode === 'table') {
      setViewMode(savedViewMode)
    }

    // Загружаем сортировку
    const savedSort = localStorage.getItem(STORAGE_KEY_SORT)
    if (savedSort) {
      try {
        const { field, direction } = JSON.parse(savedSort)
        if (['application_number', 'created_at', 'status', 'customer_fullname', 'street_and_house'].includes(field)) {
          setSortField(field as SortField)
        }
        if (direction === 'asc' || direction === 'desc') {
          setSortDirection(direction as SortDirection)
        }
      } catch { /* ignore */ }
    }

    setSettingsLoaded(true)
  }, [])

  // Сохраняем настройки в localStorage (только после загрузки)
  useEffect(() => {
    if (settingsLoaded) {
      localStorage.setItem(STORAGE_KEY_VIEW_MODE, viewMode)
    }
  }, [viewMode, settingsLoaded])

  useEffect(() => {
    if (settingsLoaded) {
      localStorage.setItem(STORAGE_KEY_ITEMS_PER_PAGE, itemsPerPage.toString())
    }
  }, [itemsPerPage, settingsLoaded])

  useEffect(() => {
    if (settingsLoaded) {
      localStorage.setItem(STORAGE_KEY_SORT, JSON.stringify({ field: sortField, direction: sortDirection }))
    }
  }, [sortField, sortDirection, settingsLoaded])

  // Статусы из БД
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({})
  const [statusesLoaded, setStatusesLoaded] = useState(false)

  // Фильтры
  const [selectedStatuses, setSelectedStatuses] = useState<ApplicationStatus[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [applicationNumberSearch, setApplicationNumberSearch] = useState('')
  const [selectedUrgency, setSelectedUrgency] = useState<Urgency | ''>('')
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | ''>('')
  const [selectedNodeId, setSelectedNodeId] = useState<string>('')
  const [nodeInfo, setNodeInfo] = useState<{ street: string; house: string } | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [addressInfo, setAddressInfo] = useState<string | null>(null)
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('')

  // Фильтры по дате
  const [datePreset, setDatePreset] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  // Список пользователей для фильтра
  const [users, setUsers] = useState<{ id: string; full_name: string; role: string }[]>([])

  const loadApplications = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      })

      if (selectedStatuses.length > 0) {
        params.append('status', selectedStatuses.join(','))
      }

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      if (applicationNumberSearch.trim()) {
        params.append('application_number', applicationNumberSearch.trim())
      }

      if (selectedUrgency) {
        params.append('urgency', selectedUrgency)
      }

      if (selectedServiceType) {
        params.append('service_type', selectedServiceType)
      }

      if (selectedNodeId) {
        params.append('node_id', selectedNodeId)
      }

      if (selectedAddressId) {
        params.append('address_id', selectedAddressId)
      }

      if (selectedAssignedTo) {
        params.append('assigned_to', selectedAssignedTo)
      }

      if (dateFrom) {
        params.append('date_from', dateFrom)
      }

      if (dateTo) {
        params.append('date_to', dateTo)
      }

      // Сортировка
      if (sortField) {
        params.append('sort_by', sortField)
        params.append('sort_dir', sortDirection)
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
  }, [page, itemsPerPage, selectedStatuses, searchQuery, applicationNumberSearch, selectedUrgency, selectedServiceType, selectedNodeId, selectedAddressId, selectedAssignedTo, dateFrom, dateTo, sortField, sortDirection])

  // Инициализация фильтров из URL при монтировании
  useEffect(() => {
    const nodeId = searchParams.get('node_id')
    const nodeStreet = searchParams.get('node_street')
    const nodeHouse = searchParams.get('node_house')
    const addressId = searchParams.get('address_id')
    const address = searchParams.get('address')
    const assignedTo = searchParams.get('assigned_to')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    if (nodeId) {
      setSelectedNodeId(nodeId)
      if (nodeStreet && nodeHouse) {
        setNodeInfo({ street: nodeStreet, house: nodeHouse })
      }
    }

    if (addressId) {
      setSelectedAddressId(addressId)
      if (address) {
        setAddressInfo(address)
      }
    }

    if (assignedTo) {
      setSelectedAssignedTo(assignedTo)
    }

    if (status) {
      setSelectedStatuses(status.split(',') as ApplicationStatus[])
    }

    if (search) {
      setSearchQuery(search)
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
        estimation_done: 'Расчёт выполнен',
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

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit)
    setPage(1)
  }

  // Обработка сортировки по столбцу
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Если уже сортируем по этому полю - меняем направление
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Иначе устанавливаем новое поле и направление по умолчанию
      setSortField(field)
      setSortDirection(field === 'created_at' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  // Иконка сортировки
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

  const totalPages = Math.ceil(total / itemsPerPage)

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
    // Используем реальный адрес от абонента, а не формализованный из справочника
    const baseAddress = app.street_and_house || 'Адрес не указан'
    const details = app.address_details ? `, ${app.address_details}` : ''
    return `№${app.application_number}. ${baseAddress}${details}`
  }

  return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Все заявки</h1>
            <span className="text-sm text-gray-500">({total})</span>
          </div>

          {/* Переключатель режима отображения */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md transition ${
                viewMode === 'cards'
                  ? 'bg-white shadow text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Карточки"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition ${
                viewMode === 'table'
                  ? 'bg-white shadow text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Таблица"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Фильтр по узлу */}
        {nodeInfo && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-blue-900">
                <span className="font-medium">Фильтр по узлу:</span> {nodeInfo.street}, {nodeInfo.house}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedNodeId('')
                setNodeInfo(null)
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

        {/* Фильтр по формализованному адресу */}
        {addressInfo && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-900">
                <span className="font-medium">Заявки по адресу:</span> {addressInfo}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedAddressId('')
                setAddressInfo(null)
                router.push('/dashboard/applications')
              }}
              className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"
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
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="№ заявки"
              value={applicationNumberSearch}
              onChange={(e) => setApplicationNumberSearch(e.target.value)}
              className="w-28 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Поиск по ФИО, телефону или адресу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-48 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              Найти
            </button>
            {(searchQuery || applicationNumberSearch || selectedStatuses.length > 0 || selectedUrgency || selectedServiceType || selectedAssignedTo || datePreset || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setApplicationNumberSearch('')
                  setSelectedStatuses([])
                  setSelectedUrgency('')
                  setSelectedServiceType('')
                  setSelectedAssignedTo('')
                  setDatePreset('')
                  setDateFrom('')
                  setDateTo('')
                  setPage(1)
                }}
                className="px-4 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Сбросить всё
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

        {/* Фильтр по дате */}
        <div className="mb-3 bg-white rounded-lg border border-gray-200 p-3">
          <h3 className="text-xs font-medium text-gray-700 mb-2">Фильтр по дате создания:</h3>
          <div className="flex flex-wrap gap-2 mb-2">
            {[
              { label: 'Сегодня', value: 'today' },
              { label: 'Вчера', value: 'yesterday' },
              { label: 'Неделя', value: 'week' },
              { label: 'Месяц', value: 'month' },
              { label: 'Год', value: 'year' },
            ].map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  const today = new Date()
                  let from = new Date()
                  const to = new Date()

                  switch (preset.value) {
                    case 'today':
                      from = new Date(today.getFullYear(), today.getMonth(), today.getDate())
                      break
                    case 'yesterday':
                      from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
                      to.setDate(today.getDate() - 1)
                      break
                    case 'week':
                      from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)
                      break
                    case 'month':
                      from = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
                      break
                    case 'year':
                      from = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
                      break
                  }

                  setDatePreset(preset.value)
                  setDateFrom(from.toISOString().split('T')[0])
                  setDateTo(to.toISOString().split('T')[0])
                  setPage(1)
                }}
                className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                  datePreset === preset.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
            {(datePreset || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDatePreset('')
                  setDateFrom('')
                  setDateTo('')
                  setPage(1)
                }}
                className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition"
              >
                Сбросить
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500">Период:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setDatePreset('')
                setPage(1)
              }}
              className="px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <span className="text-xs text-gray-500">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setDatePreset('')
                setPage(1)
              }}
              className="px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Пагинация сверху */}
        {!isLoading && total > 0 && (
          <div className="mb-3 bg-white rounded-lg border border-gray-200 p-3">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={itemsPerPage}
              onPageChange={setPage}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        )}

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
        ) : viewMode === 'cards' ? (
          /* Карточный вид */
          <div className="space-y-2">
            {applications.map((app) => (
              <div
                key={app.id}
                onClick={() => router.push(`/dashboard/applications/${app.id}`)}
                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition cursor-pointer relative group"
              >
                {/* Кнопка открытия в новом окне */}
                <a
                  href={`/dashboard/applications/${app.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="Открыть в новом окне"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>

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
                  <div className="flex items-center gap-2 mr-8">
                    {/* Иконка скрепочки если есть файлы */}
                    {app.files_count && app.files_count[0]?.count > 0 && (
                      <span className="text-gray-400" title={`Файлов: ${app.files_count[0].count}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </span>
                    )}
                    <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(app.created_at)}</span>
                  </div>
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
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500">Комментарий:</p>
                    <p className="text-xs text-gray-700 line-clamp-2">{app.client_comment}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Табличный вид */
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('application_number')}
                    >
                      <div className="flex items-center gap-1">
                        №
                        <SortIcon field="application_number" />
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center gap-1">
                        Дата
                        <SortIcon field="created_at" />
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        Статус
                        <SortIcon field="status" />
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('customer_fullname')}
                    >
                      <div className="flex items-center gap-1">
                        Клиент
                        <SortIcon field="customer_fullname" />
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('street_and_house')}
                    >
                      <div className="flex items-center gap-1">
                        Адрес
                        <SortIcon field="street_and_house" />
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Тип
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Срочность
                    </th>
                    <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {applications.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => router.push(`/dashboard/applications/${app.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-1">
                          {app.application_number}
                          {/* Иконка скрепочки если есть файлы */}
                          {app.files_count && app.files_count[0]?.count > 0 && (
                            <span className="text-gray-400" title={`Файлов: ${app.files_count[0].count}`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(app.created_at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[app.status]}`}>
                          {statusLabels[app.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={app.customer_fullname}>
                          {app.customer_fullname}
                        </div>
                        <div className="text-xs text-gray-500">
                          {customerTypeLabels[app.customer_type]}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={app.street_and_house || ''}>
                          {app.street_and_house || '—'}
                        </div>
                        {app.address_details && (
                          <div className="text-xs text-gray-500 truncate" title={app.address_details}>
                            {app.address_details}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {serviceTypeLabels[app.service_type]}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`text-sm font-medium ${urgencyColors[app.urgency]}`}>
                          {urgencyLabels[app.urgency]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <a
                          href={`/dashboard/applications/${app.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition inline-block"
                          title="Открыть в новом окне"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Пагинация снизу */}
        {!isLoading && total > 0 && (
          <div className="mt-3 bg-white rounded-lg border border-gray-200 p-3">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={itemsPerPage}
              onPageChange={setPage}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
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
