'use client'

import { useState, useEffect, useCallback } from 'react'

type AddressSource = 'local' | 'external_yandex' | 'external_osm'

type SearchStats = {
  local: number
  external: number
  total: number
  yandex: number
  openstreet: number
}

type OsmValidation = {
  status: 'match' | 'suggestions' | 'no_match'
  suggestion?: string
  suggestions?: string[]
}

interface Address {
  id: string
  street: string
  house: string
  building?: string | null
  city?: string | null
  comment: string | null
  similarity?: number
  full_address?: string
  source?: AddressSource // Источник адреса
  node_id?: string | null // ID узла (не используется для привязки заявок)
}

interface AddressLinkWizardProps {
  applicationId: string
  streetAndHouse: string
  addressDetails: string | null
  currentAddressId: string | null
  onClose: () => void
  onLink: (addressId: string) => Promise<void>
  onUnlink?: () => Promise<void>
}

export default function AddressLinkWizard({
  applicationId: _applicationId,
  streetAndHouse,
  addressDetails,
  currentAddressId,
  onClose,
  onLink,
  onUnlink,
}: AddressLinkWizardProps) {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [currentAddress, setCurrentAddress] = useState<Address | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [error, setError] = useState('')
  const [usedFallback, setUsedFallback] = useState(false)
  const [_searchStats, _setSearchStats] = useState<SearchStats | null>(null)
  const [_osmValidation, _setOsmValidation] = useState<OsmValidation | null>(null)

  // State for creating new address
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newAddress, setNewAddress] = useState({
    city: 'Томск',
    street: '',
    house: '',
    building: '',
  })
  const [streetValidation, setStreetValidation] = useState<{
    isValid: boolean
    message?: string
  } | null>(null)

  const validateAddressWithOSM = useCallback(async (address: string) => {
    try {
      const response = await fetch(`/api/addresses/validate-osm?address=${encodeURIComponent(address)}`)
      if (!response.ok) {
        _setOsmValidation({ status: 'no_match' })
        return
      }
      const data = await response.json()
      _setOsmValidation(data)
    } catch (error) {
      console.error('Error validating address with OSM:', error)
      _setOsmValidation({ status: 'no_match' })
    }
  }, [])

  const searchAddresses = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAddresses([])
      return
    }

    setIsSearching(true)
    setError('')
    _setOsmValidation(null)

    try {
      const response = await fetch(`/api/addresses/search?query=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error('Failed to search addresses')
      const data = await response.json()
      setAddresses(data.addresses || [])
      setUsedFallback(data.fallback || false)

      // Гарантируем наличие числовых счётчиков для Яндекс/OSM,
      // чтобы не было undefined при отображении бейджей
      if (data.stats) {
        _setSearchStats({
          ...data.stats,
          yandex: data.stats.yandex ?? 0,
          openstreet: data.stats.openstreet ?? 0
        })
      } else {
        _setSearchStats(null)
      }

      // Отладочная информация
      if (data.debug) {
        console.log('Search debug:', data.debug)
        console.log('Search stats:', data.stats)
      }
    } catch (error) {
      console.error('Error searching addresses:', error)
      setError('Не удалось выполнить поиск адресов')
      setAddresses([])
    } finally {
      setIsLoading(false)
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    // При открытии мастера сразу ищем по адресу из заявки
    if (streetAndHouse && streetAndHouse.trim()) {
      searchAddresses(streetAndHouse)
      // OSM validation temporarily disabled
      // validateAddressWithOSM(streetAndHouse)
    }
  }, [streetAndHouse, searchAddresses, validateAddressWithOSM])

  useEffect(() => {
    // Debounce поиска при изменении запроса
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchAddresses(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, searchAddresses])

  // Загружаем информацию о текущем адресе, если он задан
  useEffect(() => {
    async function loadCurrentAddress() {
      if (!currentAddressId) {
        setCurrentAddress(null)
        return
      }

      try {
        const response = await fetch(`/api/addresses?id=${currentAddressId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch current address')
        }

        const data = await response.json()
        if (data.data && data.data.length > 0) {
          const addr = data.data[0]
          setCurrentAddress({
            id: addr.id,
            street: addr.street || '',
            house: addr.house || '',
            building: addr.building,
            city: addr.city,
            comment: addr.comment,
            full_address: addr.address,
            source: 'local'
          })
        }
      } catch (error) {
        console.error('Error loading current address:', error)
      }
    }

    loadCurrentAddress()
  }, [currentAddressId])

  async function handleLink(address: Address) {
    setIsLinking(true)
    setError('')

    try {
      // Привязываем заявку напрямую к адресу (не к узлу!)
      await onLink(address.id)
    } catch (error) {
      console.error('Error linking address:', error)
      setError(error instanceof Error ? error.message : 'Не удалось привязать адрес')
    } finally {
      setIsLinking(false)
    }
  }

  async function handleUnlink() {
    if (!onUnlink) return

    setIsUnlinking(true)
    setError('')

    try {
      await onUnlink()
    } catch (error) {
      console.error('Error unlinking address:', error)
      setError(error instanceof Error ? error.message : 'Не удалось отвязать адрес')
    } finally {
      setIsUnlinking(false)
    }
  }

  // Валидация формата улицы
  function validateStreetFormat(street: string): { isValid: boolean; message?: string } {
    if (!street.trim()) {
      return { isValid: false, message: 'Улица не может быть пустой' }
    }

    // Допустимые префиксы улиц
    const validPrefixes = [
      'улица',
      'проспект',
      'площадь',
      'переулок',
      'бульвар',
      'шоссе',
      'тракт',
      'аллея',
      'набережная',
      'микрорайон',
      'проезд',
      'тупик',
    ]

    const trimmed = street.trim().toLowerCase()

    // Проверяем, начинается ли улица с одного из допустимых префиксов
    const hasValidPrefix = validPrefixes.some(prefix => trimmed.startsWith(prefix + ' '))

    if (!hasValidPrefix) {
      return {
        isValid: false,
        message: `Укажите тип улицы: ${validPrefixes.slice(0, 6).join(', ')} и т.д. Например: "улица Ленина"`,
      }
    }

    // Проверяем, что после префикса есть название
    const parts = trimmed.split(' ')
    if (parts.length < 2 || !parts[1]) {
      return {
        isValid: false,
        message: 'Укажите название улицы после типа. Например: "улица Ленина"',
      }
    }

    return { isValid: true }
  }

  // Проверка на дубликаты
  async function checkDuplicateAddress(
    city: string,
    street: string,
    house: string,
    building: string
  ): Promise<{ exists: boolean; existingAddress?: Address }> {
    try {
      // Формируем поисковый запрос для точного совпадения
      const searchQuery = building
        ? `${street}, ${house}, ${building}`
        : `${street}, ${house}`

      const response = await fetch(`/api/addresses/search?query=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) return { exists: false }

      const data = await response.json()
      const addresses = data.addresses || []

      // Ищем точное совпадение по всем полям
      const duplicate = addresses.find((addr: Address) => {
        const streetMatch = addr.street?.toLowerCase() === street.toLowerCase()
        const houseMatch = addr.house?.toLowerCase() === house.toLowerCase()
        const buildingMatch = building
          ? addr.comment?.toLowerCase() === building.toLowerCase()
          : !addr.comment || addr.comment.trim() === ''

        return streetMatch && houseMatch && buildingMatch
      })

      return {
        exists: !!duplicate,
        existingAddress: duplicate,
      }
    } catch (error) {
      console.error('Error checking duplicate:', error)
      return { exists: false }
    }
  }

  // Функция для нормализации названия улицы (добавление типа если отсутствует)
  function normalizeStreetName(streetName: string): string {
    const trimmed = streetName.trim()
    const lowerCased = trimmed.toLowerCase()

    // Список допустимых префиксов
    const validPrefixes = [
      'улица',
      'проспект',
      'площадь',
      'переулок',
      'бульвар',
      'шоссе',
      'тракт',
      'аллея',
      'набережная',
      'микрорайон',
      'проезд',
      'тупик',
    ]

    // Проверяем, есть ли уже префикс
    const hasPrefix = validPrefixes.some(prefix => lowerCased.startsWith(prefix + ' '))

    if (hasPrefix) {
      return trimmed
    }

    // Если префикса нет, добавляем "улица" по умолчанию
    return `улица ${trimmed}`
  }

  // Функция для разбора адреса из заявки
  function parseAddressFromApplication(addressStr: string): { street: string; house: string; building: string } {
    // Адрес обычно в формате "Улица, Дом" или "Улица Дом" или "Улица д.Дом"
    const trimmed = addressStr.trim()

    // Пробуем разные варианты разбора
    // Вариант 1: "Улица, Дом" или "Улица,Дом"
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map(p => p.trim())
      const street = normalizeStreetName(parts[0] || '')
      const houseWithBuilding = parts[1] || ''

      // Пробуем найти корпус/строение
      const buildingMatch = houseWithBuilding.match(/^(\d+[а-яА-Я]?)\s*(корп\.?\s*|к\.?\s*|стр\.?\s*)?(.*)$/i)
      if (buildingMatch) {
        return {
          street,
          house: buildingMatch[1],
          building: buildingMatch[3] || ''
        }
      }

      return { street, house: houseWithBuilding, building: '' }
    }

    // Вариант 2: "Улица д.123" или "Улица дом 123"
    const housePatternMatch = trimmed.match(/^(.+?)\s+(?:д\.?|дом)\s*(\d+[а-яА-Я]?)(?:\s*(?:корп\.?|к\.?|стр\.?)\s*(.+))?$/i)
    if (housePatternMatch) {
      return {
        street: normalizeStreetName(housePatternMatch[1].trim()),
        house: housePatternMatch[2],
        building: housePatternMatch[3] || ''
      }
    }

    // Вариант 3: "Улица 123" (последнее число - дом)
    const simpleMatch = trimmed.match(/^(.+?)\s+(\d+[а-яА-Я]?)(?:\s+(.+))?$/)
    if (simpleMatch) {
      return {
        street: normalizeStreetName(simpleMatch[1].trim()),
        house: simpleMatch[2],
        building: simpleMatch[3] || ''
      }
    }

    // Если не получилось разобрать, возвращаем всё как улицу
    return { street: normalizeStreetName(trimmed), house: '', building: '' }
  }

  async function handleCreateAddress() {
    if (!newAddress.street.trim() || !newAddress.house.trim()) {
      setError('Заполните обязательные поля: улица и номер дома')
      return
    }

    // Валидация формата улицы
    const validation = validateStreetFormat(newAddress.street)
    setStreetValidation(validation)
    if (!validation.isValid) {
      setError(validation.message || 'Неверный формат улицы')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      // Проверяем на дубликаты
      const duplicateCheck = await checkDuplicateAddress(
        newAddress.city.trim(),
        newAddress.street.trim(),
        newAddress.house.trim(),
        newAddress.building.trim()
      )

      if (duplicateCheck.exists && duplicateCheck.existingAddress) {
        setError(
          `Адрес "${newAddress.street}, ${newAddress.house}${
            newAddress.building ? ', ' + newAddress.building : ''
          }" уже существует в базе данных. Используйте его из списка ниже.`
        )
        setIsCreating(false)
        setShowCreateForm(false)
        // Обновляем поиск, чтобы показать существующий адрес
        searchAddresses(
          `${newAddress.street}, ${newAddress.house}${newAddress.building ? ', ' + newAddress.building : ''}`
        )
        return
      }

      // Создаем новый адрес в базе данных (без создания узла)
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city: newAddress.city.trim(),
          street: newAddress.street.trim(),
          house: newAddress.house.trim(),
          building: newAddress.building.trim() || null,
          comment: null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Не удалось создать адрес')
      }

      const createdAddress = await response.json()

      // Адрес создан - сразу привязываем к заявке
      setError('')
      setShowCreateForm(false)
      setNewAddress({ city: 'Томск', street: '', house: '', building: '' })
      setStreetValidation(null)

      // Привязываем созданный адрес к заявке
      await onLink(createdAddress.id)
      onClose()
    } catch (error) {
      console.error('Error creating address:', error)
      setError(error instanceof Error ? error.message : 'Не удалось создать адрес')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {currentAddressId ? 'Изменить привязку заявки к адресу' : 'Привязка заявки к адресу'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {currentAddressId
                ? 'Выберите другой адрес или отвяжите текущий'
                : 'Найдите адрес в справочнике адресов или закройте окно для привязки позже'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Адрес заявки */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Адрес из заявки:</h3>
            <p className="text-base font-semibold text-blue-900">{streetAndHouse}</p>
            {addressDetails && (
              <p className="text-sm text-blue-700 mt-1">{addressDetails}</p>
            )}
          </div>

          {/* OSM validation temporarily disabled
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3 0 2.25 3 5 3 5s3-2.75 3-5c0-1.657-1.343-3-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.5 11c0 5.5-6.5 9-8.5 9s-8.5-3.5-8.5-9a8.5 8.5 0 1117 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-900">Проверка написания через OpenStreetMap</p>
                <p className="text-xs text-gray-600">Используем OSM, чтобы убедиться, что адрес написан корректно.</p>
              </div>
            </div>

            {isLoading && !osmValidation ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                <span>Идет проверка по OpenStreetMap...</span>
              </div>
            ) : osmValidation?.status === 'match' ? (
              <div className="p-3 rounded-lg border border-green-200 bg-green-50 flex items-start gap-2">
                <svg className="w-5 h-5 text-green-700 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800">Написание совпадает с данными OSM</p>
                  {osmValidation.suggestion && (
                    <p className="text-xs text-green-700 mt-1">{osmValidation.suggestion}</p>
                  )}
                </div>
              </div>
            ) : osmValidation?.status === 'suggestions' ? (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                <p className="text-sm font-medium text-amber-800">OSM предлагает уточнения для написания</p>
                <p className="text-xs text-amber-700 mt-1">Нажмите на вариант для поиска в базе адресов.</p>
                {osmValidation.suggestions && osmValidation.suggestions.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {osmValidation.suggestions.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSearchQuery(item)
                          searchAddresses(item)
                        }}
                        className="w-full text-left px-3 py-2 text-sm rounded-md border border-amber-300 bg-white hover:bg-amber-50 hover:border-amber-400 transition text-gray-900"
                      >
                        📍 {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                <p className="text-sm font-medium text-gray-800">Подходящих подсказок в OSM не найдено</p>
                <p className="text-xs text-gray-600 mt-1">Адрес можно привязать вручную или воспользоваться подсказками других источников.</p>
              </div>
            )}
          </div>
          */}

          {/* Поиск */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Поиск по справочнику адресов {usedFallback && <span className="text-yellow-600 text-xs">(упрощенный поиск)</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Введите улицу или номер дома для уточнения..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {isSearching && (
                <div className="absolute right-3 top-2.5">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                </div>
              )}
            </div>
          </div>

          {/* Кнопка и форма создания нового адреса */}
          <div className="mb-6">
            {!showCreateForm ? (
              <button
                onClick={() => {
                  // Предзаполняем данные из адреса заявки
                  const parsed = parseAddressFromApplication(streetAndHouse)
                  setNewAddress({
                    city: 'Томск',
                    street: parsed.street,
                    house: parsed.house,
                    building: parsed.building,
                  })
                  setShowCreateForm(true)
                  setError('')
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Создать новый адрес
              </button>
            ) : (
              <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-indigo-900">Создание нового адреса</h3>
                  <button
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewAddress({ city: 'Томск', street: '', house: '', building: '' })
                      setStreetValidation(null)
                      setError('')
                    }}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Город <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      placeholder="Томск"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-blue-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Улица <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newAddress.street}
                        onChange={(e) => {
                          setNewAddress({ ...newAddress, street: e.target.value })
                          // Сбрасываем валидацию при изменении
                          if (streetValidation) setStreetValidation(null)
                        }}
                        onBlur={() => {
                          // Проверяем формат при потере фокуса
                          if (newAddress.street.trim()) {
                            const validation = validateStreetFormat(newAddress.street)
                            setStreetValidation(validation)
                          }
                        }}
                        placeholder="улица Кирова"
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                          streetValidation && !streetValidation.isValid
                            ? 'border-red-300 bg-red-50'
                            : 'border-gray-300'
                        }`}
                      />
                      {streetValidation && !streetValidation.isValid && (
                        <p className="text-xs text-red-600 mt-1">{streetValidation.message}</p>
                      )}
                      {(!streetValidation || streetValidation.isValid) && (
                        <p className="text-xs text-gray-500 mt-1">
                          Формат: &quot;улица Название&quot;, &quot;проспект Название&quot; и т.д.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Номер дома <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newAddress.house}
                        onChange={(e) => setNewAddress({ ...newAddress, house: e.target.value })}
                        placeholder="Например: 123"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Корпус/строение (необязательно)
                    </label>
                    <input
                      type="text"
                      value={newAddress.building}
                      onChange={(e) => setNewAddress({ ...newAddress, building: e.target.value })}
                      placeholder="Например: А, 1, корп. 2"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleCreateAddress}
                      disabled={isCreating || !newAddress.street.trim() || !newAddress.house.trim()}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreating ? 'Создание...' : 'Создать и привязать'}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false)
                        setNewAddress({ city: 'Томск', street: '', house: '', building: '' })
                        setStreetValidation(null)
                        setError('')
                      }}
                      disabled={isCreating}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium disabled:opacity-50"
                    >
                      Отмена
                    </button>
                  </div>
                </div>

                <p className="text-xs text-indigo-700 mt-3">
                  💡 Данные автоматически заполнены из адреса заявки
                </p>
              </div>
            )}
          </div>

          {/* Текущая привязка */}
          {currentAddress && (
            <div className="mb-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-green-900">Текущая привязка</h3>
                      <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-semibold rounded-full">
                        Активна
                      </span>
                    </div>
                    <p className="text-base font-semibold text-gray-900">
                      {currentAddress.city ? `${currentAddress.city}, ` : ''}
                      {currentAddress.street}, {currentAddress.house}
                      {currentAddress.building ? `, ${currentAddress.building}` : ''}
                    </p>
                    {currentAddress.comment && (
                      <p className="text-sm text-gray-600 mt-1">{currentAddress.comment}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Выберите другой адрес ниже для изменения привязки или нажмите кнопку Отвязать
                    </p>
                  </div>
                  {onUnlink && (
                    <button
                      onClick={handleUnlink}
                      disabled={isUnlinking || isLinking}
                      className="flex-shrink-0 px-3 py-1.5 border border-red-300 rounded-lg text-red-700 hover:bg-red-50 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUnlinking ? 'Отвязка...' : 'Отвязать'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Список адресов */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Поиск адресов...</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-4 text-gray-600">
                {searchQuery || streetAndHouse ? 'Адреса не найдены' : 'Введите запрос для поиска'}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Попробуйте изменить поисковый запрос или закройте окно
              </p>
            </div>
          ) : (
            <>
              {/* Разделяем адреса на локальные и внешние */}
              {(() => {
                const localAddresses = addresses.filter(addr =>
                  (!addr.source || addr.source === 'local') && addr.id !== currentAddressId
                )
                /* External sources temporarily disabled
                const externalAddresses = addresses.filter(addr => addr.source && addr.source !== 'local')
                const yandexAddresses = addresses.filter(addr => addr.source === 'external_yandex')
                const osmAddresses = addresses.filter(addr => addr.source === 'external_osm')

                const getSourceLabel = (source?: AddressSource) => {
                  if (source === 'external_osm') return 'OpenStreetMap'
                  if (source === 'external_yandex') return 'Яндекс'
                  return 'Внешний источник'
                }
                */

                return (
                  <div className="space-y-6">
                    {/* Локальные адреса из базы данных */}
                    {localAddresses.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                          </svg>
                          <h3 className="text-sm font-semibold text-gray-700">
                            {currentAddress ? 'Другие адреса из базы данных' : 'Адреса из базы данных'} ({localAddresses.length})
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {localAddresses.map((address) => {
                            const isCurrent = address.id === currentAddressId
                            return (
                              <button
                                key={address.id}
                                onClick={() => handleLink(address)}
                                disabled={isLinking || isUnlinking}
                                className={`w-full text-left p-4 rounded-lg border-2 transition ${
                                  isCurrent
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-200 hover:border-indigo-500 hover:bg-indigo-50'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">
                                      {address.street}, {address.house}
                                      {address.building && `, стр. ${address.building}`}
                                    </p>
                                    {address.comment && (
                                      <p className="text-sm text-gray-600 mt-1">{address.comment}</p>
                                    )}
                                  </div>
                                  {isCurrent ? (
                                    <span className="ml-2 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                      Текущий
                                    </span>
                                  ) : (
                                    <span className="ml-2 text-sm font-medium text-indigo-600">
                                      {currentAddressId ? 'Изменить →' : 'Выбрать →'}
                                    </span>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* External sources UI temporarily disabled
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-sm font-semibold text-blue-700">
                          Адреса из внешних источников ({externalAddresses.length})
                        </h3>
                        {searchStats && (
                          <span className="text-xs text-gray-500">
                            • Всего: {searchStats.total}
                            {typeof searchStats.yandex === 'number' && ` • Яндекс: ${searchStats.yandex}`}
                            {typeof searchStats.openstreet === 'number' && ` • OSM: ${searchStats.openstreet}`}
                          </span>
                        )}
                      </div>
                      {yandexAddresses.length > 0 ? (
                        <div className="space-y-2">
                          {yandexAddresses.map((address) => (
                            <button
                              key={address.id}
                              onClick={() => handleLink(address)}
                              disabled={isLinking || isUnlinking}
                              className="w-full text-left p-4 rounded-lg border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-gray-900">
                                        {address.street}, {address.house}
                                      </p>
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                        {getSourceLabel(address.source)}
                                      </span>
                                    </div>
                                    {address.comment && (
                                      <p className="text-sm text-gray-600 mt-1">{address.comment}</p>
                                    )}
                                  <p className="text-xs text-blue-600 mt-1">
                                    Будет сохранен в локальную базу при выборе
                                  </p>
                                </div>
                                <span className="ml-2 text-sm font-medium text-green-700">
                                  {currentAddressId ? 'Изменить →' : 'Выбрать →'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-blue-50 border-2 border-blue-100 rounded-lg">
                          <p className="text-sm text-blue-700">
                            {isSearching ? '⏳ Поиск во внешних источниках...' : '📭 Адреса не найдены во внешних источниках'}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Внешние API запрашиваются автоматически при отсутствии точного совпадения
                          </p>
                          {searchStats && (
                            <p className="text-xs text-gray-500 mt-1">
                              Локальных: {searchStats.local}, Внешних: {searchStats.external}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    */}

                    {/* Если нет локальных адресов */}
                    {localAddresses.length === 0 && (
                      <div className="text-center py-8">
                        <svg className="w-16 h-16 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="mt-4 text-gray-600">Адреса не найдены</p>
                        <p className="mt-2 text-sm text-gray-500">
                          Попробуйте изменить поисковый запрос
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {currentAddressId
                ? 'Выберите другой адрес для изменения привязки'
                : 'Если адреса нет в списке, вы можете привязать его позже'}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition font-medium"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
