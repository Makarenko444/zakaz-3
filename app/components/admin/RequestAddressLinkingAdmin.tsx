'use client'

import { useEffect, useState, useCallback } from 'react'

interface Address {
  id: string
  city: string
  street: string | null
  house: string | null
  building: string | null
  address: string
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
  suggested_addresses: Address[]
}

interface Stats {
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

export default function RequestAddressLinkingAdmin() {
  const [applications, setApplications] = useState<Application[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, with_suggestions: 0, without_suggestions: 0 })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Фильтры
  const [cityFilter, setCityFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Поиск адреса для конкретной заявки
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

  // Состояние привязки
  const [linkingAppId, setLinkingAppId] = useState<string | null>(null)

  const loadApplications = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (cityFilter) params.set('city', cityFilter)
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/admin/unlinked-applications?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки данных')
      }

      setApplications(data.applications || [])
      setStats(data.stats || { total: 0, with_suggestions: 0, without_suggestions: 0 })
      setPagination(prev => ({ ...prev, ...data.pagination }))
    } catch (err) {
      console.error('Error loading applications:', err)
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setIsLoading(false)
    }
  }, [pagination.page, pagination.limit, cityFilter, searchQuery])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

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

  // Привязка одной заявки к адресу
  const linkApplication = async (applicationId: string, addressId: string) => {
    setLinkingAppId(applicationId)
    setError(null)

    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address_id: addressId,
          address_match_status: 'manual_matched'
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка привязки')
      }

      // Убираем заявку из списка
      setApplications(prev => prev.filter(app => app.id !== applicationId))
      setStats(prev => ({ ...prev, total: prev.total - 1 }))
      setSuccessMessage('Заявка успешно привязана к адресу')
      setTimeout(() => setSuccessMessage(null), 3000)

      // Закрываем поиск если был открыт
      if (searchingForApp === applicationId) {
        setSearchingForApp(null)
        setAddressSearchQuery('')
        setAddressSearchResults([])
      }
    } catch (err) {
      console.error('Error linking application:', err)
      setError(err instanceof Error ? err.message : 'Ошибка привязки')
    } finally {
      setLinkingAppId(null)
    }
  }

  // Групповая привязка
  const linkMultipleApplications = async (addressId: string) => {
    if (selectedApps.size === 0) return

    setIsGroupLinking(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/unlinked-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_ids: Array.from(selectedApps),
          address_id: addressId
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Ошибка групповой привязки')
      }

      const data = await response.json()

      // Убираем привязанные заявки из списка
      setApplications(prev => prev.filter(app => !selectedApps.has(app.id)))
      setStats(prev => ({ ...prev, total: prev.total - data.linked_count }))
      setSelectedApps(new Set())
      setGroupLinkAddress(null)
      setSuccessMessage(`Успешно привязано ${data.linked_count} заявок`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error linking multiple applications:', err)
      setError(err instanceof Error ? err.message : 'Ошибка групповой привязки')
    } finally {
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
      // Создаём адрес
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

      // Привязываем заявку
      await linkApplication(applicationId, newAddress.id)

      // Сбрасываем форму
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

    // Пробуем извлечь номер дома если он в той же строке
    const houseMatch = street.match(/^(.+?)\s+(\d+[а-яА-Я]?\/?[\dа-яА-Я]*)$/)
    if (houseMatch && !house) {
      street = houseMatch[1]
      house = houseMatch[2]
    }

    // Добавляем "улица" если нет типа
    const hasPrefix = /^(улица|ул\.?|проспект|пр\.?|переулок|пер\.?|бульвар|б-р|шоссе|набережная|площадь)/i.test(street)
    if (!hasPrefix && street) {
      street = `улица ${street}`
    }

    return { street, house }
  }

  // Открытие формы создания адреса с предзаполнением
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

  // Переключение выбора заявки для групповой привязки
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

  // Выбрать все на странице
  const selectAllOnPage = () => {
    const allIds = applications.map(a => a.id)
    setSelectedApps(new Set(allIds))
  }

  // Снять выбор
  const deselectAll = () => {
    setSelectedApps(new Set())
  }

  if (isLoading && applications.length === 0) {
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

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Всего непривязанных</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-green-600">{stats.with_suggestions}</div>
          <div className="text-sm text-gray-600">С подсказками</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-amber-600">{stats.without_suggestions}</div>
          <div className="text-sm text-gray-600">Без совпадений</div>
        </div>
      </div>

      {/* Сообщения */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-600 hover:text-red-800">
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {successMessage}
        </div>
      )}

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
            onClick={loadApplications}
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
              <button
                onClick={deselectAll}
                className="text-indigo-600 hover:text-indigo-800 text-sm"
              >
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
                    onClick={() => linkMultipleApplications(groupLinkAddress.id)}
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
        {/* Заголовок таблицы */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
          <div className="w-8">
            <input
              type="checkbox"
              checked={selectedApps.size === applications.length && applications.length > 0}
              onChange={() => {
                if (selectedApps.size === applications.length) {
                  deselectAll()
                } else {
                  selectAllOnPage()
                }
              }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          <div className="w-20 text-xs font-medium text-gray-500 uppercase">№</div>
          <div className="flex-1 text-xs font-medium text-gray-500 uppercase">Адрес из заявки</div>
          <div className="w-32 text-xs font-medium text-gray-500 uppercase">Тип</div>
          <div className="w-64 text-xs font-medium text-gray-500 uppercase">Похожие адреса</div>
          <div className="w-40 text-xs font-medium text-gray-500 uppercase">Действия</div>
        </div>

        {/* Строки заявок */}
        {applications.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            {isLoading ? 'Загрузка...' : 'Нет непривязанных заявок'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {applications.map((app) => (
              <div key={app.id} className="px-4 py-4">
                <div className="flex items-start gap-4">
                  {/* Чекбокс */}
                  <div className="w-8 pt-1">
                    <input
                      type="checkbox"
                      checked={selectedApps.has(app.id)}
                      onChange={() => toggleAppSelection(app.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Номер заявки */}
                  <div className="w-20">
                    <a
                      href={`/dashboard/applications/${app.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      #{app.application_number}
                    </a>
                  </div>

                  {/* Адрес из заявки */}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{app.street_and_house || '—'}</div>
                    {app.address_details && (
                      <div className="text-sm text-gray-500">{app.address_details}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {app.city} &bull; {app.customer_fullname}
                    </div>
                  </div>

                  {/* Тип клиента */}
                  <div className="w-32">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      app.customer_type === 'business'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {app.customer_type === 'business' ? 'Юрлицо' : 'Физлицо'}
                    </span>
                  </div>

                  {/* Похожие адреса */}
                  <div className="w-64">
                    {app.suggested_addresses.length > 0 ? (
                      <div className="space-y-1">
                        {app.suggested_addresses.slice(0, 3).map((addr) => (
                          <button
                            key={addr.id}
                            onClick={() => {
                              if (selectedApps.size > 0 && selectedApps.has(app.id)) {
                                setGroupLinkAddress(addr)
                              } else {
                                linkApplication(app.id, addr.id)
                              }
                            }}
                            disabled={linkingAppId === app.id}
                            className="w-full text-left px-2 py-1 text-sm bg-green-50 hover:bg-green-100 border border-green-200 rounded transition disabled:opacity-50"
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate text-gray-900">{addr.address}</span>
                              <span className="text-green-600 text-xs ml-1 flex-shrink-0">
                                {linkingAppId === app.id ? '...' : ''}
                              </span>
                            </div>
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

                  {/* Действия */}
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

                {/* Расширенный поиск адреса */}
                {searchingForApp === app.id && (
                  <div className="mt-4 ml-12 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="text"
                        value={addressSearchQuery}
                        onChange={(e) => setAddressSearchQuery(e.target.value)}
                        placeholder="Введите адрес для поиска..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                            onClick={() => linkApplication(app.id, addr.id)}
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
                        &times;
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Город</label>
                        <input
                          type="text"
                          value={newAddressForm.city}
                          onChange={(e) => setNewAddressForm(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Улица *</label>
                        <input
                          type="text"
                          value={newAddressForm.street}
                          onChange={(e) => setNewAddressForm(prev => ({ ...prev, street: e.target.value }))}
                          placeholder="улица Ленина"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Дом *</label>
                        <input
                          type="text"
                          value={newAddressForm.house}
                          onChange={(e) => setNewAddressForm(prev => ({ ...prev, house: e.target.value }))}
                          placeholder="15"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              Страница {pagination.page} из {pagination.totalPages} (всего {pagination.total})
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Назад
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Вперёд
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
