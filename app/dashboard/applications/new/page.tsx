'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth-client'

// Схема валидации
const applicationSchema = z.object({
  address_mode: z.enum(['select', 'freeform']),
  address_id: z.string().optional(),
  freeform_address: z.string().optional(),
  entrance: z.string().optional(),
  floor: z.string().optional(),
  apartment: z.string().optional(),
  customer_type: z.enum(['individual', 'business']),
  service_type: z.enum(['apartment', 'office', 'scs']),
  customer_fullname: z.string().min(2, 'Введите ФИО/название компании'),
  customer_phone: z.string().min(10, 'Введите корректный телефон'),
  contact_person: z.string().optional(),
  contact_phone: z.string().optional(),
  urgency: z.enum(['low', 'normal', 'high', 'critical']),
  client_comment: z.string().optional(),
}).refine(
  (data) => {
    // Для юр.лиц обязательны контактные данные
    if (data.customer_type === 'business') {
      return !!data.contact_person && !!data.contact_phone
    }
    return true
  },
  {
    message: 'Для юридического лица обязательны контактное лицо и телефон',
    path: ['contact_person'],
  }
).refine(
  (data) => {
    // Проверяем что указан либо адрес из справочника, либо адрес в свободной форме
    if (data.address_mode === 'select') {
      return !!data.address_id && data.address_id.length > 0
    } else {
      return !!data.freeform_address && data.freeform_address.length > 0
    }
  },
  {
    message: 'Укажите адрес',
    path: ['freeform_address'],
  }
)

type ApplicationFormData = z.infer<typeof applicationSchema>

interface Address {
  id: string
  street: string
  house: string
}

export default function NewApplicationPage() {
  const router = useRouter()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      address_mode: 'freeform',
      customer_type: 'individual',
      service_type: 'apartment',
      urgency: 'normal',
    },
  })

  const customerType = watch('customer_type')
  const addressMode = watch('address_mode')

  useEffect(() => {
    loadAddresses()
    loadCurrentUser()
  }, [])

  async function loadAddresses() {
    try {
      const response = await fetch('/api/addresses')
      if (!response.ok) throw new Error('Failed to load addresses')
      const data = await response.json()
      setAddresses(data.addresses)
    } catch (error) {
      console.error('Error loading addresses:', error)
      setError('Не удалось загрузить список адресов')
    } finally {
      setIsLoadingAddresses(false)
    }
  }

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

      await response.json()

      // Редирект на страницу созданной заявки или на список
      router.push('/dashboard/applications')
      router.refresh()
    } catch (error: unknown) {
      console.error('Error creating application:', error)
      setError(error instanceof Error ? error.message : 'Не удалось создать заявку')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatAddress = (address: Address) => {
    return `${address.street}, ${address.house}`
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

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border border-gray-200 p-6">
          {/* Режим ввода адреса */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Способ указания адреса <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  {...register('address_mode')}
                  value="freeform"
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Ввести адрес вручную</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  {...register('address_mode')}
                  value="select"
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Выбрать из справочника</span>
              </label>
            </div>
          </div>

          {/* Адрес подключения */}
          {addressMode === 'freeform' ? (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Адрес подключения <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('freeform_address')}
                placeholder="Например: ул. Ленина, д. 10, кв. 5"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.freeform_address && (
                <p className="mt-1 text-sm text-red-600">{errors.freeform_address.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                После создания заявки адрес можно будет добавить в справочник
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Адрес из справочника <span className="text-red-500">*</span>
                </label>
                {isLoadingAddresses ? (
                  <div className="text-sm text-gray-500">Загрузка адресов...</div>
                ) : (
                  <select
                    {...register('address_id')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Выберите адрес</option>
                    {addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {formatAddress(address)}
                      </option>
                    ))}
                  </select>
                )}
                {errors.address_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.address_id.message}</p>
                )}
              </div>

              {/* Дополнительные данные адреса */}
              <div className="mb-6 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Подъезд
                  </label>
                  <input
                    type="text"
                    {...register('entrance')}
                    placeholder="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Этаж
                  </label>
                  <input
                    type="text"
                    {...register('floor')}
                    placeholder="5"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Квартира
                  </label>
                  <input
                    type="text"
                    {...register('apartment')}
                    placeholder="42"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </>
          )}

          {/* Тип клиента */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип клиента <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  {...register('customer_type')}
                  value="individual"
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Физическое лицо</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  {...register('customer_type')}
                  value="business"
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Юридическое лицо</span>
              </label>
            </div>
            {errors.customer_type && (
              <p className="mt-1 text-sm text-red-600">{errors.customer_type.message}</p>
            )}
          </div>

          {/* ФИО / Название компании */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {customerType === 'business' ? 'Название компании' : 'ФИО клиента'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('customer_fullname')}
              placeholder={customerType === 'business' ? 'ООО "Компания"' : 'Иванов Иван Иванович'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {errors.customer_fullname && (
              <p className="mt-1 text-sm text-red-600">{errors.customer_fullname.message}</p>
            )}
          </div>

          {/* Телефон заказчика */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Телефон заказчика <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              {...register('customer_phone')}
              placeholder="+79991234567"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {errors.customer_phone && (
              <p className="mt-1 text-sm text-red-600">{errors.customer_phone.message}</p>
            )}
          </div>

          {/* Контактное лицо (для юр.лиц) */}
          {customerType === 'business' && (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Контактное лицо <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('contact_person')}
                  placeholder="Петров Петр Петрович"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {errors.contact_person && (
                  <p className="mt-1 text-sm text-red-600">{errors.contact_person.message}</p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Телефон контактного лица <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  {...register('contact_phone')}
                  placeholder="+79997654321"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {errors.contact_phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.contact_phone.message}</p>
                )}
              </div>
            </>
          )}

          {/* Тип услуги */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип услуги <span className="text-red-500">*</span>
            </label>
            <select
              {...register('service_type')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="apartment">Подключение квартиры</option>
              <option value="office">Подключение офиса</option>
              <option value="scs">Строительство СКС</option>
            </select>
            {errors.service_type && (
              <p className="mt-1 text-sm text-red-600">{errors.service_type.message}</p>
            )}
          </div>

          {/* Срочность */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Срочность <span className="text-red-500">*</span>
            </label>
            <select
              {...register('urgency')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="low">Низкая</option>
              <option value="normal">Обычная</option>
              <option value="high">Высокая</option>
              <option value="critical">Критическая</option>
            </select>
            {errors.urgency && (
              <p className="mt-1 text-sm text-red-600">{errors.urgency.message}</p>
            )}
          </div>

          {/* Комментарий клиента */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Комментарий клиента
            </label>
            <textarea
              {...register('client_comment')}
              rows={4}
              placeholder="Дополнительная информация от клиента..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            {errors.client_comment && (
              <p className="mt-1 text-sm text-red-600">{errors.client_comment.message}</p>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex gap-4 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
