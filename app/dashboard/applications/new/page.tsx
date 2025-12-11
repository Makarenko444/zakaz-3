'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth-client'

// Схема валидации
const applicationSchema = z.object({
  city: z.string().min(1, 'Укажите город'),
  street_and_house: z.string().min(3, 'Укажите улицу и номер дома'),
  address_details: z.string().optional(),
  customer_type: z.enum(['individual', 'business']),
  service_type: z.enum(['apartment', 'office', 'scs']),
  customer_fullname: z.string().min(2, 'Введите ФИО/название компании'),
  customer_phone: z.string().min(10, 'Введите корректный телефон'),
  contact_person: z.string().optional(),
  contact_phone: z.string().optional(),
  urgency: z.enum(['low', 'normal', 'high', 'critical']),
  client_comment: z.string().optional(),
})

type ApplicationFormData = z.infer<typeof applicationSchema>

export default function NewApplicationPage() {
  const router = useRouter()
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
      city: 'Томск',
      customer_type: 'individual',
      service_type: 'apartment',
      urgency: 'normal',
    },
  })

  const customerType = watch('customer_type')

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

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border border-gray-200 p-6">
          {/* Адрес подключения */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Город <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('city')}
              placeholder="Томск"
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {errors.city && (
              <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Улица и номер дома <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('street_and_house')}
              placeholder="Например: ул. Ленина, д. 10"
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {errors.street_and_house && (
              <p className="mt-1 text-sm text-red-600">{errors.street_and_house.message}</p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Подъезд, этаж, квартира/офис
            </label>
            <input
              type="text"
              {...register('address_details')}
              placeholder="Например: подъезд 2, этаж 5, кв. 42"
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {errors.address_details && (
              <p className="mt-1 text-sm text-red-600">{errors.address_details.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              После создания заявки адрес можно будет привязать к узлу из справочника
            </p>
          </div>

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
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                  Контактное лицо
                </label>
                <input
                  type="text"
                  {...register('contact_person')}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {errors.contact_person && (
                  <p className="mt-1 text-sm text-red-600">{errors.contact_person.message}</p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Телефон контактного лица
                </label>
                <input
                  type="tel"
                  {...register('contact_phone')}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
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
