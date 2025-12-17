'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CustomerType, ServiceType, Urgency } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth-client'

// Схема валидации
const applicationSchema = z.object({
  service_type: z.enum(['apartment', 'office', 'scs', 'emergency', 'access_control', 'node_construction', 'trunk_construction', 'video_surveillance']),
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

interface Application {
  id: string
  node_id: string | null
  city: string
  street_and_house: string | null
  address_details: string | null
  customer_type: CustomerType
  service_type: ServiceType
  customer_fullname: string
  customer_phone: string
  contact_person: string | null
  contact_phone: string | null
  urgency: Urgency
  client_comment: string | null
  assigned_to: string | null
}

// Компонент блока формы
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
        {title}
      </h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}

export default function EditApplicationPage() {
  const router = useRouter()
  const params = useParams()
  const applicationId = params.id as string

  const [isLoadingApplication, setIsLoadingApplication] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [assignedTo, setAssignedTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
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

  const loadApplication = useCallback(async () => {
    try {
      const response = await fetch(`/api/applications/${applicationId}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Заявка не найдена')
        }
        throw new Error('Failed to load application')
      }
      const data = await response.json()
      const app: Application = data.application

      // Сохраняем node_id и assigned_to для отправки при обновлении
      setNodeId(app.node_id)
      setAssignedTo(app.assigned_to)

      // Заполняем форму данными заявки
      reset({
        service_type: app.service_type,
        city: app.city || 'Томск',
        street_and_house: app.street_and_house || '',
        address_details: app.address_details || '',
        customer_type: app.customer_type,
        customer_fullname: app.customer_fullname,
        customer_phone: app.customer_phone,
        contact_person: app.contact_person || '',
        contact_phone: app.contact_phone || '',
        urgency: app.urgency,
        client_comment: app.client_comment || '',
      })
    } catch (error) {
      console.error('Error loading application:', error)
      setError(error instanceof Error ? error.message : 'Не удалось загрузить заявку')
    } finally {
      setIsLoadingApplication(false)
    }
  }, [applicationId, reset])

  useEffect(() => {
    loadApplication()
    loadCurrentUser()
  }, [loadApplication])

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
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          node_id: nodeId,
          assigned_to: assignedTo,
          updated_by: currentUserId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update application')
      }

      await response.json()

      // Редирект на страницу заявки
      router.push(`/dashboard/applications/${applicationId}`)
      router.refresh()
    } catch (error: unknown) {
      console.error('Error updating application:', error)
      setError(error instanceof Error ? error.message : 'Не удалось обновить заявку')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingApplication) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
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
              <h1 className="text-2xl font-bold text-gray-900">Редактирование заявки</h1>
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

          {/* Блок 1: Тип работ */}
          <FormSection title="Тип работ">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тип работ <span className="text-red-500">*</span>
              </label>
              <select
                {...register('service_type')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                  <option value="video_surveillance">Видеонаблюдение</option>
                  <option value="emergency">Аварийная заявка</option>
                </optgroup>
              </select>
              {errors.service_type && (
                <p className="mt-1 text-sm text-red-600">{errors.service_type.message}</p>
              )}
            </div>
          </FormSection>

          {/* Блок 2: Адрес подключения */}
          <FormSection title="Адрес подключения">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Город <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('city')}
                placeholder="Томск"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.city && (
                <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Улица и номер дома <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('street_and_house')}
                placeholder="Например: пр. Кирова, д.22"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.street_and_house && (
                <p className="mt-1 text-sm text-red-600">{errors.street_and_house.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Подъезд, этаж, квартира/офис
              </label>
              <input
                type="text"
                {...register('address_details')}
                placeholder="Например: подъезд 2, этаж 5, кв. 42"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.address_details && (
                <p className="mt-1 text-sm text-red-600">{errors.address_details.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Привязать адрес к узлу можно на странице просмотра заявки
              </p>
            </div>
          </FormSection>

          {/* Блок 3: Данные клиента */}
          <FormSection title="Данные клиента">
            <div>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {customerType === 'business' ? 'Название компании' : 'ФИО клиента'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('customer_fullname')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.customer_fullname && (
                <p className="mt-1 text-sm text-red-600">{errors.customer_fullname.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Контакты заказчика (телефон, email) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('customer_phone')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-400">Формат: +7-9XX-XXX-XX-XX</p>
              {errors.customer_phone && (
                <p className="mt-1 text-sm text-red-600">{errors.customer_phone.message}</p>
              )}
            </div>

            {/* Контактное лицо (для юр.лиц) */}
            {customerType === 'business' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Контактное лицо
                  </label>
                  <input
                    type="text"
                    {...register('contact_person')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  {errors.contact_person && (
                    <p className="mt-1 text-sm text-red-600">{errors.contact_person.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Телефон контактного лица
                  </label>
                  <input
                    type="tel"
                    {...register('contact_phone')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-400">Формат: +7-9XX-XXX-XX-XX</p>
                  {errors.contact_phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.contact_phone.message}</p>
                  )}
                </div>
              </>
            )}
          </FormSection>

          {/* Блок 4: Дополнительно */}
          <FormSection title="Дополнительно">
            <div>
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

            <div>
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
          </FormSection>

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
                  Сохранение...
                </>
              ) : (
                'Сохранить изменения'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
