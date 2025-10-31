'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Application, ApplicationStatus, Urgency, CustomerType, ServiceType } from '@/lib/types'

// Расширенный тип для заявки с адресом
interface ApplicationWithAddress extends Application {
  zakaz_addresses: {
    street: string
    house: string
    entrance: string | null
    comment: string | null
  } | null
}

// Переводы
const statusLabels: Record<ApplicationStatus, string> = {
  new: 'Новая',
  thinking: 'Думает',
  estimation: 'Расчёт',
  waiting_payment: 'Ожидание оплаты',
  contract: 'Договор',
  queue_install: 'Очередь на монтаж',
  install: 'Монтаж',
  installed: 'Выполнено',
  rejected: 'Отказ',
  no_tech: 'Нет тех. возможности',
}

const statusColors: Record<ApplicationStatus, string> = {
  new: 'bg-gray-100 text-gray-800',
  thinking: 'bg-blue-100 text-blue-800',
  estimation: 'bg-indigo-100 text-indigo-800',
  waiting_payment: 'bg-amber-100 text-amber-800',
  contract: 'bg-cyan-100 text-cyan-800',
  queue_install: 'bg-purple-100 text-purple-800',
  install: 'bg-violet-100 text-violet-800',
  installed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  no_tech: 'bg-orange-100 text-orange-800',
}

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

const customerTypeLabels: Record<CustomerType, string> = {
  individual: 'Физическое лицо',
  business: 'Юридическое лицо',
}

const serviceTypeLabels: Record<ServiceType, string> = {
  apartment: 'Подключение квартиры',
  office: 'Подключение офиса',
  scs: 'Строительство СКС',
}

export default function ApplicationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [application, setApplication] = useState<ApplicationWithAddress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadApplication()
  }, [id])

  async function loadApplication() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/applications/${id}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('Заявка не найдена')
        } else {
          throw new Error('Failed to load application')
        }
        return
      }

      const data = await response.json()
      setApplication(data.application)
    } catch (error) {
      console.error('Error loading application:', error)
      setError('Не удалось загрузить заявку')
    } finally {
      setIsLoading(false)
    }
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

  const formatAddress = (address: ApplicationWithAddress['zakaz_addresses']) => {
    if (!address) return 'Адрес не указан'
    const parts = [address.street, address.house]
    if (address.entrance) parts.push(`подъезд ${address.entrance}`)
    return parts.join(', ')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/dashboard/applications')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Заявка</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
            <button
              onClick={() => router.push('/dashboard/applications')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Вернуться к списку
            </button>
          </div>
        </main>
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
                onClick={() => router.push('/dashboard/applications')}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Заявка #{application.application_number}
              </h1>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusColors[application.status]}`}>
                {statusLabels[application.status]}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/dashboard/applications/${id}/edit`)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Редактировать
              </button>
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Изменить статус
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Основная информация */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Информация о заявке</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Дата создания</p>
              <p className="text-base font-medium text-gray-900">{formatDate(application.created_at)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Последнее обновление</p>
              <p className="text-base font-medium text-gray-900">{formatDate(application.updated_at)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Срочность</p>
              <p className={`text-base font-semibold ${urgencyColors[application.urgency]}`}>
                {urgencyLabels[application.urgency]}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Тип услуги</p>
              <p className="text-base font-medium text-gray-900">{serviceTypeLabels[application.service_type]}</p>
            </div>
          </div>
        </div>

        {/* Адрес */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Адрес подключения</h2>
          <p className="text-base font-medium text-gray-900">{formatAddress(application.zakaz_addresses)}</p>
          {application.zakaz_addresses?.comment && (
            <p className="mt-2 text-sm text-gray-600">{application.zakaz_addresses.comment}</p>
          )}
        </div>

        {/* Информация о клиенте */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Информация о клиенте</h2>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Тип клиента</p>
              <p className="text-base font-medium text-gray-900">{customerTypeLabels[application.customer_type]}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">
                {application.customer_type === 'business' ? 'Название компании' : 'ФИО клиента'}
              </p>
              <p className="text-base font-medium text-gray-900">{application.customer_fullname}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Телефон заказчика</p>
              <p className="text-base font-medium text-gray-900">
                <a href={`tel:${application.customer_phone}`} className="text-indigo-600 hover:text-indigo-700">
                  {application.customer_phone}
                </a>
              </p>
            </div>

            {application.customer_type === 'business' && (
              <>
                {application.contact_person && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Контактное лицо</p>
                    <p className="text-base font-medium text-gray-900">{application.contact_person}</p>
                  </div>
                )}

                {application.contact_phone && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Телефон контактного лица</p>
                    <p className="text-base font-medium text-gray-900">
                      <a href={`tel:${application.contact_phone}`} className="text-indigo-600 hover:text-indigo-700">
                        {application.contact_phone}
                      </a>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Комментарий клиента */}
        {application.client_comment && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Комментарий клиента</h2>
            <p className="text-base text-gray-700 whitespace-pre-wrap">{application.client_comment}</p>
          </div>
        )}
      </main>
    </div>
  )
}
