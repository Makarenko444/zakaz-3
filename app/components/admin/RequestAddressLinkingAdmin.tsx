'use client'

import { useEffect, useState, useCallback } from 'react'

interface Address {
  id: string
  city: string
  street: string | null
  house: string | null
  building: string | null
  address: string
  linked_applications?: number
  potential_applications?: number
}

type SortField = 'address' | 'city' | 'linked_applications' | 'potential_applications'
type SortDirection = 'asc' | 'desc'

interface SortState {
  field: SortField
  direction: SortDirection
}

interface Application {
  id: string
  application_number: number
  city: string
  street_and_house: string | null
  address_details: string | null
  customer_type: string
  customer_fullname: string
  created_at: string
  suggested_addresses?: Address[]
  similarity?: number
}

interface GlobalStats {
  total_applications: number
  linked: number
  unlinked: number
}

interface Stats extends GlobalStats {
  total: number
  with_suggestions: number
  without_suggestions: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

type ViewMode = 'applications' | 'addresses'

export default function RequestAddressLinkingAdmin() {
  // Режим отображения
  const [viewMode, setViewMode] = useState<ViewMode>('applications')

  // Данные для режима "заявки"
  const [applications, setApplications] = useState<Application[]>([])

  // Данные для режима "адреса"
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null)
  const [addressApplications, setAddressApplications] = useState<Application[]>([])

  // Общие
  const [stats, setStats] = useState<Stats>({
    total_applications: 0,
    linked: 0,
    unlinked: 0,
    total: 0,
    with_suggestions: 0,
    without_suggestions: 0
  })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Фильтры
  const [cityFilter, setCityFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Сортировка (с сохранением в localStorage)
  const [addressSort, setAddressSort] = useState<SortState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_address_linking_sort')
      if (saved) {
        try {
          return JSON.parse(saved) as SortState
        } catch {
          // ignore
        }
      }
    }
    return { field: 'address', direction: 'asc' }
  })

  // Поиск адреса для конкретной заявки (режим applications)
  const [searchingForApp, setSearchingForApp] = useState<string | null>(null)
  const [addressSearchQuery, setAddressSearchQuery] = useState<string>('')
  const [addressSearchResults, setAddressSearchResults] = useState<Address[]>([])
  const [isSearchingAddresses, setIsSearchingAddresses] = useState(false)

  // Создание нового адреса
  const [creatingForApp, setCreatingForApp] = useState<string | null>(null)
  const [newAddressForm, setNewAddressForm] = useState({
    city: 'Томск',
    street: '',
    house: '',
    building: ''
  })
  const [isCreatingAddress, setIsCreatingAddress] = useState(false)

  // Групповая привязка
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set())
  const [groupLinkAddress, setGroupLinkAddress] = useState<Address | null>(null)
  const [isGroupLinking, setIsGroupLinking] = useState(false)

  // Порог похожести для автовыбора (в процентах)
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(50)

  // Состояние привязки
  const [linkingAppId, setLinkingAppId] = useState<string | null>(null)

  // Сохранение сортировки в localStorage
  const handleSortChange = (field: SortField) => {
    setAddressSort(prev => {
      const newSort: SortState = {
        field,
        direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
      }
      localStorage.setItem('admin_address_linking_sort', JSON.stringify(newSort))
      return newSort
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  // Загрузка данных
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('mode', viewMode)
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (cityFilter) params.set('city', cityFilter)
      if (searchQuery) params.set('search', searchQuery)

      // Параметры сортировки для режима адресов
      if (viewMode === 'addresses') {
        params.set('sort_field', addressSort.field)
        params.set('sort_direction', addressSort.direction)
      }

      const response = await fetch(`/api/admin/unlinked-applications?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки данных')
      }

      if (viewMode === 'applications') {
        setApplications(data.applications || [])
        setStats(data.stats || {
          total_applications: 0,
          linked: 0,
          unlinked: 0,
          total: 0,
          with_suggestions: 0,
          without_suggestions: 0
        })
      } else {
        setAddresses(data.addresses || [])
        setStats(prev => ({ ...prev, ...data.stats }))
      }

      setPagination(prev => ({ ...prev, ...data.pagination }))
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setIsLoading(false)
    }
  }, [viewMode, pagination.page, pagination.limit, cityFilter, searchQuery, addressSort])

  // Применить порог похожести для выбора заявок
  const applyThreshold = useCallback((apps: Application[], threshold: number) => {
    const thresholdDecimal = threshold / 100
    const selectedIds = apps
      .filter((app) => app.similarity !== undefined && app.similarity >= thresholdDecimal)
      .map((app) => app.id)
    setSelectedApps(new Set(selectedIds))
  }, [])

  // Загрузка заявок для выбранного адреса
  const loadAddressApplications = useCallback(async (addressId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/admin/unlinked-applications?mode=addresses&address_id=${addressId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки')
      }

      setSelectedAddress(data.address)
      const apps: Application[] = data.applications || []
      setAddressApplications(apps)
      setStats(prev => ({ ...prev, ...data.stats }))

      // Автоматически выбираем заявки с текущим порогом похожести
      applyThreshold(apps, similarityThreshold)
    } catch (err) {
      console.error('Error loading address applications:', err)
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }, [applyThreshold, similarityThreshold])

  useEffect(() => {
    if (!selectedAddress) {
      loadData()
    }
  }, [loadData, selectedAddress])

  // Сброс при смене режима
  useEffect(() => {
    setSelectedAddress(null)
    setAddressApplications([])
    setSelectedApps(new Set())
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [viewMode])

  // Поиск адресов
  const searchAddresses = async (query: string) => {
    if (!query.trim()) {
      setAddressSearchResults([])
      return
    }

    setIsSearchingAddresses(true)
    try {
      const response = await fetch(`/api/addresses/search?query=${encodeURIComponent(query)}`)
      const data = await response.json()
      setAddressSearchResults(data.addresses || [])
    } catch (err) {
      console.error('Error searching addresses:', err)
    } finally {
      setIsSearchingAddresses(false)
    }
  }

  // Debounce для поиска адресов
  useEffect(() => {
    if (!searchingForApp) return

    const timeout = setTimeout(() => {
      searchAddresses(addressSearchQuery)
    }, 300)

    return () => clearTimeout(timeout)
  }, [addressSearchQuery, searchingForApp])

  // Привязка заявок к адресу
  const linkApplications = async (applicationIds: string[], addressId: string) => {
    if (applicationIds.length === 1) {
      setLinkingAppId(applicationIds[0])
    } else {
      setIsGroupLinking(true)
    }
    setError(null)

    try {
      const response = await fetch('/api/admin/unlinked-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_ids: applicationIds,
          address_id: addressId
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка привязки')
      }

      const data = await response.json()

      // Обновляем UI
      if (viewMode === 'applications') {
        setApplications(prev => prev.filter(app => !applicationIds.includes(app.id)))
        setStats(prev => ({
          ...prev,
          total: prev.total - data.linked_count,
          linked: prev.linked + data.linked_count,
          unlinked: prev.unlinked - data.linked_count
        }))
      } else if (selectedAddress) {
        setAddressApplications(prev => prev.filter(app => !applicationIds.includes(app.id)))
        setStats(prev => ({
          ...prev,
          linked: prev.linked + data.linked_count,
          unlinked: prev.unlinked - data.linked_count
        }))
      }

      setSelectedApps(new Set())
      setGroupLinkAddress(null)
      setSuccessMessage(`Успешно привязано ${data.linked_count} заявок`)
      setTimeout(() => setSuccessMessage(null), 3000)

      // Закрываем поиск если был открыт
      if (searchingForApp && applicationIds.includes(searchingForApp)) {
        setSearchingForApp(null)
        setAddressSearchQuery('')
        setAddressSearchResults([])
      }
    } catch (err) {
      console.error('Error linking applications:', err)
      setError(err instanceof Error ? err.message : 'Ошибка привязки')
    } finally {
      setLinkingAppId(null)
      setIsGroupLinking(false)
    }
  }

  // Создание нового адреса и привязка
  const createAddressAndLink = async (applicationId: string) => {
    if (!newAddressForm.street.trim() || !newAddressForm.house.trim()) {
      setError('Укажите улицу и номер дома')
      return
    }

    setIsCreatingAddress(true)
    setError(null)

    try {
      const createResponse = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: newAddressForm.city.trim(),
          street: newAddressForm.street.trim(),
          house: newAddressForm.house.trim(),
          building: newAddressForm.building.trim() || null
        })
      })

      if (!createResponse.ok) {
        const data = await createResponse.json()
        throw new Error(data.error || 'Ошибка создания адреса')
      }

      const newAddress = await createResponse.json()
      await linkApplications([applicationId], newAddress.id)

      setCreatingForApp(null)
      setNewAddressForm({ city: 'Томск', street: '', house: '', building: '' })
    } catch (err) {
      console.error('Error creating address:', err)
      setError(err instanceof Error ? err.message : 'Ошибка создания адреса')
    } finally {
      setIsCreatingAddress(false)
    }
  }

  // Парсинг адреса из строки заявки
  const parseAddressFromApplication = (streetAndHouse: string) => {
    const parts = streetAndHouse.split(',').map(p => p.trim())
    let street = parts[0] || ''
    let house = parts[1] || ''

    const houseMatch = street.match(/^(.+?)\s+(\d+[а-яА-Я]?\/?[\dа-яА-Я]*)$/)
    if (houseMatch && !house) {
      street = houseMatch[1]
      house = houseMatch[2]
    }

    const hasPrefix = /^(улица|ул\.?|проспект|пр\.?|переулок|пер\.?|бульвар|б-р|шоссе|набережная|площадь)/i.test(street)
    if (!hasPrefix && street) {
      street = `улица ${street}`
    }

    return { street, house }
  }

  const openCreateForm = (app: Application) => {
    const parsed = parseAddressFromApplication(app.street_and_house || '')
    setNewAddressForm({
      city: app.city || 'Томск',
      street: parsed.street,
      house: parsed.house,
      building: ''
    })
    setCreatingForApp(app.id)
    setSearchingForApp(null)
  }

  const toggleAppSelection = (appId: string) => {
    setSelectedApps(prev => {
      const next = new Set(prev)
      if (next.has(appId)) {
        next.delete(appId)
      } else {
        next.add(appId)
      }
      return next
    })
  }

  const selectAllOnPage = () => {
    const list = viewMode === 'applications' ? applications : addressApplications
    setSelectedApps(new Set(list.map(a => a.id)))
  }

  const deselectAll = () => {
    setSelectedApps(new Set())
  }

  if (isLoading && applications.length === 0 && addresses.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Загрузка...</span>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Привязка заявок к адресам</h2>
        <p className="text-sm text-gray-600 mt-1">
          Инструмент для привязки непривязанных заявок к адресам из справочника
        </p>
      </div>

      {/* Глобальная статистика */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-gray-900">{stats.total_applications}</div>
          <div className="text-sm text-gray-600">Всего заявок</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-green-600">{stats.linked}</div>
          <div className="text-sm text-gray-600">Привязано</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-amber-600">{stats.unlinked}</div>
          <div className="text-sm text-gray-600">Не привязано</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-indigo-600">
            {stats.total_applications > 0
              ? Math.round((stats.linked / stats.total_applications) * 100)
              : 0}%
          </div>
          <div className="text-sm text-gray-600">Покрытие</div>
        </div>
      </div>

      {/* Переключатель режимов */}
      <div className="bg-white rounded-lg shadow p-2 mb-6 inline-flex">
        <button
          onClick={() => setViewMode('applications')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            viewMode === 'applications'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          От заявок к адресам
        </button>
        <button
          onClick={() => setViewMode('addresses')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            viewMode === 'addresses'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          От адресов к заявкам
        </button>
      </div>

      {/* Сообщения */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-600 hover:text-red-800">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {successMessage}
        </div>
      )}

      {/* Режим "От заявок к адресам" */}
      {viewMode === 'applications' && (
        <>
          {/* Статистика страницы */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">На странице</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-xl font-bold text-green-600">{stats.with_suggestions}</div>
              <div className="text-xs text-gray-600">С подсказками (нашли похожий адрес)</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <div className="text-xl font-bold text-amber-600">{stats.without_suggestions}</div>
              <div className="text-xs text-gray-600">Без совпадений (нужен ручной поиск)</div>
            </div>
          </div>

          {/* Фильтры */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  placeholder="Адрес или имя клиента..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                <select
                  value={cityFilter}
                  onChange={(e) => {
                    setCityFilter(e.target.value)
                    setPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Все города</option>
                  <option value="Томск">Томск</option>
                  <option value="Северск">Северск</option>
                </select>
              </div>
              <button
                onClick={loadData}
                disabled={isLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {isLoading ? 'Загрузка...' : 'Обновить'}
              </button>
            </div>
          </div>

          {/* Групповые действия */}
          {selectedApps.size > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-indigo-800 font-medium">
                    Выбрано: {selectedApps.size} заявок
                  </span>
                  <button onClick={deselectAll} className="text-indigo-600 hover:text-indigo-800 text-sm">
                    Снять выбор
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {groupLinkAddress ? (
                    <>
                      <span className="text-sm text-gray-600">
                        Привязать к: <strong>{groupLinkAddress.address}</strong>
                      </span>
                      <button
                        onClick={() => linkApplications(Array.from(selectedApps), groupLinkAddress.id)}
                        disabled={isGroupLinking}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                      >
                        {isGroupLinking ? 'Привязка...' : 'Подтвердить'}
                      </button>
                      <button
                        onClick={() => setGroupLinkAddress(null)}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Отмена
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-600">
                      Выберите адрес из подсказок для групповой привязки
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Список заявок */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
              <div className="w-8">
                <input
                  type="checkbox"
                  checked={selectedApps.size === applications.length && applications.length > 0}
                  onChange={() => selectedApps.size === applications.length ? deselectAll() : selectAllOnPage()}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="w-20 text-xs font-medium text-gray-500 uppercase">№</div>
              <div className="flex-1 text-xs font-medium text-gray-500 uppercase">Адрес из заявки</div>
              <div className="w-32 text-xs font-medium text-gray-500 uppercase">Тип</div>
              <div className="w-64 text-xs font-medium text-gray-500 uppercase">Похожие адреса</div>
              <div className="w-40 text-xs font-medium text-gray-500 uppercase">Действия</div>
            </div>

            {applications.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                {isLoading ? 'Загрузка...' : 'Нет непривязанных заявок'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {applications.map((app) => (
                  <div key={app.id} className="px-4 py-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 pt-1">
                        <input
                          type="checkbox"
                          checked={selectedApps.has(app.id)}
                          onChange={() => toggleAppSelection(app.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="w-20">
                        <a
                          href={`/dashboard/applications/${app.id}`}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          #{app.application_number}
                        </a>
                      </div>

                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{app.street_and_house || '—'}</div>
                        {app.address_details && (
                          <div className="text-sm text-gray-500">{app.address_details}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {app.city} • {app.customer_fullname}
                        </div>
                      </div>

                      <div className="w-32">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          app.customer_type === 'business'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {app.customer_type === 'business' ? 'Юрлицо' : 'Физлицо'}
                        </span>
                      </div>

                      <div className="w-64">
                        {app.suggested_addresses && app.suggested_addresses.length > 0 ? (
                          <div className="space-y-1">
                            {app.suggested_addresses.slice(0, 3).map((addr) => (
                              <button
                                key={addr.id}
                                onClick={() => {
                                  if (selectedApps.size > 0 && selectedApps.has(app.id)) {
                                    setGroupLinkAddress(addr)
                                  } else {
                                    linkApplications([app.id], addr.id)
                                  }
                                }}
                                disabled={linkingAppId === app.id}
                                className="w-full text-left px-2 py-1 text-sm bg-green-50 hover:bg-green-100 border border-green-200 rounded transition disabled:opacity-50"
                              >
                                <span className="truncate block text-gray-900">{addr.address}</span>
                              </button>
                            ))}
                            {app.suggested_addresses.length > 3 && (
                              <div className="text-xs text-gray-500 pl-2">
                                +{app.suggested_addresses.length - 3} ещё
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Нет совпадений</span>
                        )}
                      </div>

                      <div className="w-40 flex flex-col gap-1">
                        <button
                          onClick={() => {
                            setSearchingForApp(app.id)
                            setAddressSearchQuery(app.street_and_house || '')
                            setCreatingForApp(null)
                          }}
                          className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition"
                        >
                          Искать адрес
                        </button>
                        <button
                          onClick={() => openCreateForm(app)}
                          className="px-3 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition"
                        >
                          Создать новый
                        </button>
                      </div>
                    </div>

                    {/* Расширенный поиск */}
                    {searchingForApp === app.id && (
                      <div className="mt-4 ml-12 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3 mb-3">
                          <input
                            type="text"
                            value={addressSearchQuery}
                            onChange={(e) => setAddressSearchQuery(e.target.value)}
                            placeholder="Введите адрес для поиска..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              setSearchingForApp(null)
                              setAddressSearchQuery('')
                              setAddressSearchResults([])
                            }}
                            className="px-3 py-2 text-gray-600 hover:text-gray-800"
                          >
                            Закрыть
                          </button>
                        </div>

                        {isSearchingAddresses ? (
                          <div className="text-sm text-gray-500">Поиск...</div>
                        ) : addressSearchResults.length > 0 ? (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {addressSearchResults.map((addr) => (
                              <button
                                key={addr.id}
                                onClick={() => linkApplications([app.id], addr.id)}
                                disabled={linkingAppId === app.id}
                                className="w-full text-left px-3 py-2 text-sm bg-white hover:bg-indigo-50 border border-gray-200 rounded transition disabled:opacity-50"
                              >
                                {addr.address}
                              </button>
                            ))}
                          </div>
                        ) : addressSearchQuery.trim() ? (
                          <div className="text-sm text-gray-500">Адреса не найдены</div>
                        ) : null}
                      </div>
                    )}

                    {/* Форма создания адреса */}
                    {creatingForApp === app.id && (
                      <div className="mt-4 ml-12 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-indigo-900">Создание нового адреса</h4>
                          <button
                            onClick={() => {
                              setCreatingForApp(null)
                              setNewAddressForm({ city: 'Томск', street: '', house: '', building: '' })
                            }}
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Город</label>
                            <input
                              type="text"
                              value={newAddressForm.city}
                              onChange={(e) => setNewAddressForm(prev => ({ ...prev, city: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-600 mb-1">Улица *</label>
                            <input
                              type="text"
                              value={newAddressForm.street}
                              onChange={(e) => setNewAddressForm(prev => ({ ...prev, street: e.target.value }))}
                              placeholder="улица Ленина"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Дом *</label>
                            <input
                              type="text"
                              value={newAddressForm.house}
                              onChange={(e) => setNewAddressForm(prev => ({ ...prev, house: e.target.value }))}
                              placeholder="15"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-32">
                            <label className="block text-xs text-gray-600 mb-1">Строение</label>
                            <input
                              type="text"
                              value={newAddressForm.building}
                              onChange={(e) => setNewAddressForm(prev => ({ ...prev, building: e.target.value }))}
                              placeholder="корп. 1"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div className="flex-1"></div>
                          <button
                            onClick={() => createAddressAndLink(app.id)}
                            disabled={isCreatingAddress || !newAddressForm.street.trim() || !newAddressForm.house.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                          >
                            {isCreatingAddress ? 'Создание...' : 'Создать и привязать'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Пагинация */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Страница {pagination.page} из {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Режим "От адресов к заявкам" */}
      {viewMode === 'addresses' && !selectedAddress && (
        <>
          {/* Фильтры */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Поиск адреса</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  placeholder="Улица, дом..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                <select
                  value={cityFilter}
                  onChange={(e) => {
                    setCityFilter(e.target.value)
                    setPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Все города</option>
                  <option value="Томск">Томск</option>
                  <option value="Северск">Северск</option>
                </select>
              </div>
              <button
                onClick={loadData}
                disabled={isLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {isLoading ? 'Загрузка...' : 'Обновить'}
              </button>
            </div>
          </div>

          {/* Список адресов */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
              <button
                onClick={() => handleSortChange('address')}
                className="flex-1 text-xs font-medium text-gray-500 uppercase text-left hover:text-gray-700 flex items-center gap-1"
              >
                Адрес
                {addressSort.field === 'address' && (
                  <span className="text-indigo-600">{addressSort.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              <button
                onClick={() => handleSortChange('linked_applications')}
                className="w-32 text-xs font-medium text-gray-500 uppercase text-center hover:text-gray-700 flex items-center justify-center gap-1"
              >
                Привязано
                {addressSort.field === 'linked_applications' && (
                  <span className="text-indigo-600">{addressSort.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              <button
                onClick={() => handleSortChange('potential_applications')}
                className="w-40 text-xs font-medium text-gray-500 uppercase text-center hover:text-gray-700 flex items-center justify-center gap-1"
              >
                К привязке
                {addressSort.field === 'potential_applications' && (
                  <span className="text-indigo-600">{addressSort.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              <div className="w-32 text-xs font-medium text-gray-500 uppercase">Действие</div>
            </div>

            {addresses.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                {isLoading ? 'Загрузка...' : 'Нет адресов'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {addresses.map((addr) => (
                  <div key={addr.id} className="px-4 py-4 flex items-center gap-4 hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{addr.address}</div>
                      <div className="text-xs text-gray-400">{addr.city}</div>
                    </div>
                    <div className="w-32 text-center">
                      {addr.linked_applications && addr.linked_applications > 0 ? (
                        <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
                          {addr.linked_applications}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </div>
                    <div className="w-40 text-center">
                      {addr.potential_applications && addr.potential_applications > 0 ? (
                        <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-amber-100 text-amber-800">
                          {addr.potential_applications}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </div>
                    <div className="w-32">
                      <button
                        onClick={() => loadAddressApplications(addr.id)}
                        disabled={!addr.potential_applications || addr.potential_applications === 0}
                        className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Посмотреть
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Пагинация */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Страница {pagination.page} из {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Детальный вид адреса с заявками */}
      {viewMode === 'addresses' && selectedAddress && (
        <>
          {/* Навигация назад */}
          <div className="mb-4">
            <button
              onClick={() => {
                setSelectedAddress(null)
                setAddressApplications([])
                setSelectedApps(new Set())
              }}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад к списку адресов
            </button>
          </div>

          {/* Информация об адресе и настройки */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-indigo-900">{selectedAddress.address}</h3>
                <p className="text-sm text-indigo-700 mt-1">
                  Найдено {addressApplications.length} заявок, которые можно привязать к этому адресу
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-indigo-700">Порог:</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={similarityThreshold}
                  onChange={(e) => setSimilarityThreshold(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                  className="w-16 px-2 py-1 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <span className="text-sm text-indigo-700">%</span>
                <button
                  onClick={() => applyThreshold(addressApplications, similarityThreshold)}
                  className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                >
                  Применить
                </button>
              </div>
            </div>
          </div>

          {/* Групповые действия */}
          {selectedApps.size > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-green-800 font-medium">
                    Выбрано: {selectedApps.size} заявок
                  </span>
                  <button onClick={deselectAll} className="text-green-600 hover:text-green-800 text-sm">
                    Снять выбор
                  </button>
                </div>
                <button
                  onClick={() => linkApplications(Array.from(selectedApps), selectedAddress.id)}
                  disabled={isGroupLinking}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {isGroupLinking ? 'Привязка...' : `Привязать ${selectedApps.size} заявок`}
                </button>
              </div>
            </div>
          )}

          {/* Список заявок для привязки */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
              <div className="w-8">
                <input
                  type="checkbox"
                  checked={selectedApps.size === addressApplications.length && addressApplications.length > 0}
                  onChange={() => selectedApps.size === addressApplications.length ? deselectAll() : selectAllOnPage()}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="w-20 text-xs font-medium text-gray-500 uppercase">№</div>
              <div className="flex-1 text-xs font-medium text-gray-500 uppercase">Адрес из заявки</div>
              <div className="w-32 text-xs font-medium text-gray-500 uppercase">Тип</div>
              <div className="w-24 text-xs font-medium text-gray-500 uppercase text-center">Схожесть</div>
              <div className="w-32 text-xs font-medium text-gray-500 uppercase">Действие</div>
            </div>

            {addressApplications.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                Нет заявок для привязки к этому адресу
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {addressApplications.map((app) => (
                  <div key={app.id} className="px-4 py-4 flex items-center gap-4 hover:bg-gray-50">
                    <div className="w-8">
                      <input
                        type="checkbox"
                        checked={selectedApps.has(app.id)}
                        onChange={() => toggleAppSelection(app.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="w-20">
                      <a
                        href={`/dashboard/applications/${app.id}`}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        #{app.application_number}
                      </a>
                    </div>

                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{app.street_and_house}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {app.city} • {app.customer_fullname}
                      </div>
                    </div>

                    <div className="w-32">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        app.customer_type === 'business'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {app.customer_type === 'business' ? 'Юрлицо' : 'Физлицо'}
                      </span>
                    </div>

                    <div className="w-24 text-center">
                      {app.similarity !== undefined && (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          app.similarity >= 0.7
                            ? 'bg-green-100 text-green-800'
                            : app.similarity >= 0.4
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {Math.round(app.similarity * 100)}%
                        </span>
                      )}
                    </div>

                    <div className="w-32">
                      <button
                        onClick={() => linkApplications([app.id], selectedAddress.id)}
                        disabled={linkingAppId === app.id}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
                      >
                        {linkingAppId === app.id ? '...' : 'Привязать'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
