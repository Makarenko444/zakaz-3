'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth-client'

// Схема валидации
const applicationSchema = z.object({
  service_type: z.enum(['apartment', 'office', 'scs', 'emergency', 'access_control', 'node_construction', 'trunk_construction']),
  city: z.string().min(1, 'Укажите город'),
  street_and_house: z.string().min(3, 'Укажите улицу и номер дома'),
  address_details: z.string().optional(),
  customer_type: z.enum(['individual', 'business']),
  customer_fullname: z.string().min(2, 'Введите ФИО/название компании'),
  customer_phone: z.string().min(5, 'Введите контактные данные'),
  contact_person: z.string().optional(),
  contact_phone: z.string().optional(),
  urgency: z.enum(['low', 'normal', 'high', 'critical']),
  client_comment: z.string().optional(),
})

type ApplicationFormData = z.infer<typeof applicationSchema>

interface AddressSuggestion {
  id: string
  street: string
  house: string
  full_address: string
  source: 'local' | 'external_yandex' | 'external_osm'
}

// Компонент блока формы - компактный
function FormSection({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-5 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1.5 border-b border-gray-200 uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}

export default function NewApplicationPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Автоподсказки адресов
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      city: 'Томск',
      customer_type: 'individual',
      service_type: 'apartment',
      urgency: 'normal',
    },
  })

  const customerType = watch('customer_type')
  const serviceType = watch('service_type')
  const streetAndHouse = watch('street_and_house')

  // Автопереключение на "Юр. лицо" при выборе офиса
  useEffect(() => {
    if (serviceType === 'office' && customerType === 'individual') {
      setValue('customer_type', 'business')
    }
  }, [serviceType, customerType, setValue])

  // Автопереключение на "офис" при выборе юр.лица (только если квартира)
  useEffect(() => {
    if (customerType === 'business' && serviceType === 'apartment') {
      setValue('service_type', 'office')
    }
  }, [customerType, serviceType, setValue])

  // Поиск адресов для автоподсказок
  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([])
      setShowSuggestions(false)
      return
    }

    setIsLoadingSuggestions(true)
    try {
      const response = await fetch(`/api/addresses/search?query=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setAddressSuggestions(data.addresses || [])
        setShowSuggestions(true)
      }
    } catch (err) {
      console.error('Error searching addresses:', err)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [])

  // Debounced поиск при вводе адреса
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (streetAndHouse && streetAndHouse.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        searchAddresses(streetAndHouse)
      }, 300)
    } else {
      setAddressSuggestions([])
      setShowSuggestions(false)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [streetAndHouse, searchAddresses])

  // Закрытие подсказок при клике вне
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Выбор адреса из подсказки
  const selectAddress = (suggestion: AddressSuggestion) => {
    setValue('street_and_house', suggestion.full_address)
    setShowSuggestions(false)
  }

  useEffect(() => {
    loadCurrentUser()
  }, [])

  async function loadCurrentUser() {
    try {
      const user = await getCurrentUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    } catch (error) {
      console.error('Error loading current user:', error)
    }
  }

  async function onSubmit(data: ApplicationFormData) {
    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          created_by: currentUserId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create application')
      }

      const result = await response.json()

      // Редирект на страницу созданной заявки (для запуска мастера привязки)
      router.push(`/dashboard/applications/${result.application.id}`)
      router.refresh()
    } catch (error: unknown) {
      console.error('Error creating application:', error)
      setError(error instanceof Error ? error.message : 'Не удалось создать заявку')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Новая заявка</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border border-gray-200 p-5">
          {/* Две колонки на десктопе */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Левая колонка */}
            <div>
              {/* Блок 1: Тип работ */}
              <FormSection title="Тип работ">
                <select
                  {...register('service_type')}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                >
                  <optgroup label="Подключение">
                    <option value="apartment">Подключение квартиры</option>
                    <option value="office">Подключение офиса</option>
                  </optgroup>
                  <optgroup label="Строительство">
                    <option value="scs">Строительство СКС</option>
                    <option value="node_construction">Строительство Узла</option>
                    <option value="trunk_construction">Строительство магистрали</option>
                  </optgroup>
                  <optgroup label="Прочее">
                    <option value="access_control">СКУД</option>
                    <option value="emergency">Аварийная заявка</option>
                  </optgroup>
                </select>
                {errors.service_type && (
                  <p className="text-xs text-red-600">{errors.service_type.message}</p>
                )}
              </FormSection>

              {/* Блок 2: Адрес */}
              <FormSection title="Адрес">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <input
                      type="text"
                      {...register('city')}
                      placeholder="Город"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                    {errors.city && (
                      <p className="text-xs text-red-600 mt-0.5">{errors.city.message}</p>
                    )}
                  </div>
                  <div className="col-span-2 relative" ref={suggestionsRef}>
                    <div className="relative">
                      <input
                        type="text"
                        {...register('street_and_house')}
                        placeholder="Улица и номер дома"
                        autoComplete="off"
                        onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                      {isLoadingSuggestions && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
                        </div>
                      )}
                    </div>
                    {/* Выпадающий список подсказок */}
                    {showSuggestions && addressSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {addressSuggestions.map((suggestion, idx) => (
                          <button
                            key={`${suggestion.id}-${idx}`}
                            type="button"
                            onClick={() => selectAddress(suggestion)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 flex items-center gap-2 border-b border-gray-100 last:border-0"
                          >
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              suggestion.source === 'local'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {suggestion.source === 'local' ? 'БД' : 'API'}
                            </span>
                            <span className="truncate">{suggestion.full_address}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {errors.street_and_house && (
                      <p className="text-xs text-red-600 mt-0.5">{errors.street_and_house.message}</p>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  {...register('address_details')}
                  placeholder="Подъезд, этаж, квартира/офис"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </FormSection>

              {/* Блок: Срочность */}
              <FormSection title="Срочность">
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'low', label: 'Низкая', color: 'bg-gray-100 text-gray-700 border-gray-300' },
                    { value: 'normal', label: 'Обычная', color: 'bg-blue-50 text-blue-700 border-blue-300' },
                    { value: 'high', label: 'Высокая', color: 'bg-orange-50 text-orange-700 border-orange-300' },
                    { value: 'critical', label: 'Критическая', color: 'bg-red-50 text-red-700 border-red-300' },
                  ].map((item) => (
                    <label
                      key={item.value}
                      className={`flex items-center px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition ${
                        watch('urgency') === item.value
                          ? item.color + ' ring-2 ring-offset-1 ring-indigo-400'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        {...register('urgency')}
                        value={item.value}
                        className="sr-only"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </FormSection>
            </div>

            {/* Правая колонка */}
            <div>
              {/* Блок 3: Данные клиента */}
              <FormSection title="Клиент">
                {/* Тип клиента - кнопки */}
                <div className="flex gap-2">
                  <label className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer text-sm transition ${
                    customerType === 'individual'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-offset-1 ring-indigo-400'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      {...register('customer_type')}
                      value="individual"
                      className="sr-only"
                    />
                    Физ. лицо
                  </label>
                  <label className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer text-sm transition ${
                    customerType === 'business'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-offset-1 ring-indigo-400'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      {...register('customer_type')}
                      value="business"
                      className="sr-only"
                    />
                    Юр. лицо
                  </label>
                </div>

                <input
                  type="text"
                  {...register('customer_fullname')}
                  placeholder={customerType === 'business' ? 'Название компании' : 'ФИО клиента'}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                {errors.customer_fullname && (
                  <p className="text-xs text-red-600">{errors.customer_fullname.message}</p>
                )}

                <input
                  type="text"
                  {...register('customer_phone')}
                  placeholder="Телефон, email"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                {errors.customer_phone && (
                  <p className="text-xs text-red-600">{errors.customer_phone.message}</p>
                )}

                {/* Контактное лицо (для юр.лиц) */}
                {customerType === 'business' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      {...register('contact_person')}
                      placeholder="Контактное лицо"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                    <input
                      type="tel"
                      {...register('contact_phone')}
                      placeholder="Телефон контакта"
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                )}
              </FormSection>

              {/* Блок: Комментарий */}
              <FormSection title="Комментарий">
                <textarea
                  {...register('client_comment')}
                  rows={3}
                  placeholder="Дополнительная информация..."
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                />
              </FormSection>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 justify-end pt-4 mt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Создание...
                </>
              ) : (
                'Создать заявку'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
