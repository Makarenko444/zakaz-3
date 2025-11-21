'use client'

import { useState, useEffect } from 'react'

interface Address {
  id: string
  street: string
  house: string
  comment: string | null
  similarity?: number
  full_address?: string
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
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [error, setError] = useState('')
  const [usedFallback, setUsedFallback] = useState(false)

  useEffect(() => {
    // При открытии мастера сразу ищем по адресу из заявки
    searchAddresses(streetAndHouse)
  }, [])

  useEffect(() => {
    // Debounce поиска при изменении запроса
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchAddresses(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  async function searchAddresses(query: string) {
    if (!query.trim()) {
      setAddresses([])
      return
    }

    setIsSearching(true)
    setError('')

    try {
      const response = await fetch(`/api/addresses/search?query=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error('Failed to search addresses')
      const data = await response.json()
      setAddresses(data.addresses || [])
      setUsedFallback(data.fallback || false)
    } catch (error) {
      console.error('Error searching addresses:', error)
      setError('Не удалось выполнить поиск адресов')
      setAddresses([])
    } finally {
      setIsLoading(false)
      setIsSearching(false)
    }
  }

  async function handleLink(addressId: string) {
    setIsLinking(true)
    setError('')

    try {
      await onLink(addressId)
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {currentAddressId ? 'Изменить привязку к узлу' : 'Привязка адреса к узлу'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {currentAddressId
                ? 'Выберите другой адрес или отвяжите текущий'
                : 'Найдите адрес в справочнике узлов или закройте окно для привязки позже'}
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
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-3">
                Найдено адресов: {addresses.length}
                {addresses.length > 0 && addresses[0].similarity !== undefined && (
                  <span className="ml-2 text-xs text-gray-500">
                    (отсортировано по релевантности)
                  </span>
                )}
              </p>
              {addresses.map((address) => {
                const isCurrent = address.id === currentAddressId
                return (
                  <button
                    key={address.id}
                    onClick={() => handleLink(address.id)}
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
                        <span className="ml-2 text-indigo-600 text-sm font-medium">
                          {currentAddressId ? 'Изменить →' : 'Выбрать →'}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {currentAddressId && onUnlink && (
                <button
                  onClick={handleUnlink}
                  disabled={isUnlinking || isLinking}
                  className="px-4 py-2 border border-red-300 rounded-lg text-red-700 hover:bg-red-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUnlinking ? 'Отвязка...' : 'Отвязать от узла'}
                </button>
              )}
              <p className="text-sm text-gray-600">
                {currentAddressId
                  ? 'Вы можете изменить привязку или отвязать заявку от узла'
                  : 'Если адреса нет в списке, вы можете привязать его позже'}
              </p>
            </div>
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
