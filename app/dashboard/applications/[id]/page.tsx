'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Application, ApplicationStatus, Urgency, CustomerType, ServiceType, User } from '@/lib/types'
import StatusChangeModal from '@/app/components/StatusChangeModal'
import AuditLog from '@/app/components/AuditLog'
import AuditLogModal from '@/app/components/AuditLogModal'
import Comments from '@/app/components/Comments'
import FileUpload from '@/app/components/FileUpload'
import FileList from '@/app/components/FileList'
import AddressLinkWizard from '@/app/components/AddressLinkWizard'
import { getCurrentUser } from '@/lib/auth-client'

// Расширенный тип для заявки с адресом
interface ApplicationWithAddress extends Application {
  zakaz_addresses: {
    street: string
    house: string
    comment: string | null
  } | null
  assigned_user?: {
    id: string
    full_name: string
    email: string
    role: string
  } | null
  created_by_user?: {
    id: string
    full_name: string
    email: string
    role: string
  } | null
  updated_by_user?: {
    id: string
    full_name: string
    email: string
    role: string
  } | null
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
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [isAssigning, setIsAssigning] = useState(false)
  const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>('')
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('')
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [showAuditLogModal, setShowAuditLogModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showAddressWizard, setShowAddressWizard] = useState(false)

  // Статусы из БД
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({})

  const loadApplication = useCallback(async () => {
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
  }, [id])

  useEffect(() => {
    loadStatuses()
    loadApplication()
    loadUsers()
    loadCurrentUser()
  }, [id, loadApplication])

  // Автоматически открываем мастера привязки, если адрес не привязан к справочнику
  useEffect(() => {
    if (application && !application.address_id && (application.street_and_house)) {
      setShowAddressWizard(true)
    }
  }, [application])

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
    } catch (error) {
      console.error('Error loading statuses:', error)
      // Используем fallback значения при ошибке
      setStatusLabels({
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
      })
    }
  }

  async function loadUsers() {
    try {
      const response = await fetch('/api/users')
      if (!response.ok) throw new Error('Failed to load users')
      const data = await response.json()
      setUsers(data.users)
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  async function loadCurrentUser() {
    try {
      const user = await getCurrentUser()
      if (user) {
        setCurrentUserId(user.id)
        setCurrentUserName(user.full_name)
        setCurrentUserEmail(user.email)
        setCurrentUserRole(user.role)
      }
    } catch (error) {
      console.error('Error loading current user:', error)
    }
  }

  async function handleAssignUser(userId: string) {
    setIsAssigning(true)
    try {
      const response = await fetch(`/api/applications/${id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assigned_to: userId,
          changed_by: currentUserId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to assign user')
      }

      const data = await response.json()
      setApplication(data.application)
    } catch (error) {
      console.error('Error assigning user:', error)
      alert('Не удалось назначить исполнителя')
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleLinkAddress(addressId: string) {
    if (!application) return

    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...application,
          address_id: addressId,
          updated_by: currentUserId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to link address')
      }

      const data = await response.json()
      setApplication(data.application)
      setShowAddressWizard(false)
    } catch (error) {
      console.error('Error linking address:', error)
      throw error
    }
  }

  async function handleUnlinkAddress() {
    if (!application) return

    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...application,
          address_id: null,
          updated_by: currentUserId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to unlink address')
      }

      const data = await response.json()
      setApplication(data.application)
      setShowAddressWizard(false)
    } catch (error) {
      console.error('Error unlinking address:', error)
      throw error
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
    return `${address.street}, ${address.house}`
  }

  const formatTitle = () => {
    if (!application) return ''

    let title = `№${application.application_number}`

    // Добавляем адрес из заявки
    if (application.street_and_house) {
      title += `. ${application.street_and_house}`
    }

    // Добавляем детали адреса (подъезд, квартира)
    if (application.address_details) {
      title += `. ${application.address_details}`
    }

    return title
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop header */}
          <div className="hidden md:flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/applications')}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                {formatTitle()}
              </h1>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusColors[application.status]}`}>
                {statusLabels[application.status]}
              </span>
              <span className={`px-3 py-1 text-sm font-semibold ${urgencyColors[application.urgency]}`}>
                {urgencyLabels[application.urgency]}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/dashboard/applications/${id}/edit`)}
                className="px-3 lg:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden lg:inline">Редактировать</span>
              </button>
              <button
                onClick={() => setShowStatusModal(true)}
                className="px-3 lg:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span className="hidden lg:inline">Изменить статус</span>
                <span className="lg:hidden">Статус</span>
              </button>
            </div>
          </div>

          {/* Mobile header */}
          <div className="md:hidden py-3">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => router.push('/dashboard/applications')}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-bold text-gray-900 flex-1">
                {formatTitle()}
              </h1>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[application.status]}`}>
                  {statusLabels[application.status]}
                </span>
                <span className={`px-2 py-1 text-xs font-semibold ${urgencyColors[application.urgency]}`}>
                  {urgencyLabels[application.urgency]}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/dashboard/applications/${id}/edit`)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-xs font-medium"
                >
                  Редактировать
                </button>
                <button
                  onClick={() => setShowStatusModal(true)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-xs font-medium"
                >
                  Статус
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* 2-колоночный layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
          {/* Левая колонка - Компактная информация */}
          <div className="lg:col-span-2 space-y-4">
            {/* Компактная карточка с основной информацией */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              {/* Основные данные в двухколоночном виде */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4 pb-4 border-b border-gray-200">
                {/* Первая колонка */}
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-500">Создана:</span>{' '}
                    <span className="font-medium text-gray-900">
                      {application.created_by_user ? application.created_by_user.full_name : 'Неизвестен'}
                    </span>
                    <span className="text-gray-500"> ({formatDate(application.created_at)})</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Обновлена:</span>{' '}
                    <span className="font-medium text-gray-900">
                      {application.updated_by_user ? application.updated_by_user.full_name : 'Неизвестен'}
                    </span>
                    <span className="text-gray-500"> ({formatDate(application.updated_at)})</span>
                  </div>
                </div>

                {/* Вторая колонка */}
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-500">Услуга:</span>{' '}
                    <span className="font-medium text-gray-900">{serviceTypeLabels[application.service_type]}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Менеджер:</span>{' '}
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition"
                    >
                      {application.assigned_user ? application.assigned_user.full_name : 'Не назначен'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Адрес */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex justify-between items-center gap-3">
                  {/* Адрес заявки */}
                  <div className="flex-1">
                    {application.street_and_house && (
                      <p className="text-base text-gray-900">
                        <span className="text-gray-500">Адрес:</span>{' '}
                        <span className="font-medium">
                          {application.street_and_house}
                          {application.address_details && `, ${application.address_details}`}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Привязка к узлу справа */}
                  <div className="flex items-center gap-2">
                    {application.address_id && application.zakaz_addresses ? (
                      <Link
                        href={`/dashboard/applications?address_id=${application.address_id}&address_street=${encodeURIComponent(application.zakaz_addresses.street)}&address_house=${encodeURIComponent(application.zakaz_addresses.house)}`}
                        className="flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition"
                      >
                        <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs font-medium text-green-700 hover:text-green-800">
                          Узел: {formatAddress(application.zakaz_addresses)}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-xs text-amber-600 px-2 py-1">Без узла</span>
                    )}
                    {application.street_and_house && (
                      <button
                        onClick={() => setShowAddressWizard(true)}
                        className={`text-xs px-2 py-1 rounded transition ${
                          application.address_id
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                        }`}
                      >
                        {application.address_id ? 'Изменить' : 'Привязать'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Информация о клиенте - компактно */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-base font-bold text-gray-900 mb-2">Клиент</p>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-500">{customerTypeLabels[application.customer_type]}:</span>{' '}
                    <span className="font-medium text-gray-900">{application.customer_fullname}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Телефон:</span>{' '}
                    <a href={`tel:${application.customer_phone}`} className="text-indigo-600 hover:text-indigo-700 font-medium">
                      {application.customer_phone}
                    </a>
                  </p>
                  {application.customer_type === 'business' && application.contact_person && (
                    <>
                      <p>
                        <span className="text-gray-500">Контакт:</span>{' '}
                        <span className="text-gray-900">{application.contact_person}</span>
                      </p>
                      {application.contact_phone && (
                        <p>
                          <span className="text-gray-500">Тел. контакта:</span>{' '}
                          <a href={`tel:${application.contact_phone}`} className="text-indigo-600 hover:text-indigo-700">
                            {application.contact_phone}
                          </a>
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Комментарий клиента */}
              {application.client_comment && (
                <div>
                  <p className="text-base font-bold text-gray-900 mb-2">Комментарий клиента</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{application.client_comment}</p>
                </div>
              )}
            </div>

            {/* Комментарии сотрудников */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">Комментарии сотрудников</h2>
              <Comments
                applicationId={id}
                currentUserId={currentUserId || undefined}
                currentUserName={currentUserName || 'Аноним'}
                currentUserEmail={currentUserEmail || undefined}
                currentUserRole={currentUserRole || undefined}
                onFileUploaded={() => setFileRefreshTrigger(prev => prev + 1)}
              />
            </div>
          </div>

          {/* Правая колонка - Файлы и история */}
          <div className="lg:col-span-1 space-y-4">
            {/* Файлы заявки */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">Прикрепленные файлы</h3>

              {/* Список файлов с миниатюрами */}
              <FileList
                applicationId={id}
                refreshTrigger={fileRefreshTrigger}
                showThumbnails={true}
                className="mb-3"
                currentUserId={currentUserId || undefined}
                currentUserRole={currentUserRole || undefined}
              />

              {/* Загрузка файлов */}
              <div className="pt-3 border-t border-gray-200">
                <FileUpload
                  applicationId={id}
                  onFileUploaded={() => setFileRefreshTrigger(prev => prev + 1)}
                  maxFiles={5}
                />
              </div>
            </div>

            {/* История изменений */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">История изменений</h3>
              <AuditLog
                applicationId={id}
                limit={5}
                onShowAll={() => setShowAuditLogModal(true)}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Модальное окно изменения статуса */}
      {showStatusModal && (
        <StatusChangeModal
          applicationId={id}
          currentStatus={application.status}
          onClose={() => setShowStatusModal(false)}
          onStatusChanged={() => {
            setShowStatusModal(false)
            loadApplication()
          }}
        />
      )}

      {/* Модальное окно полной истории */}
      {showAuditLogModal && (
        <AuditLogModal
          applicationId={id}
          onClose={() => setShowAuditLogModal(false)}
        />
      )}

      {/* Модальное окно назначения менеджера */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Назначить менеджера</h3>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="space-y-2">
                {/* Опция "Не назначен" */}
                <button
                  onClick={() => {
                    handleAssignUser('')
                    setShowAssignModal(false)
                  }}
                  disabled={isAssigning}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                    !application.assigned_to
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="font-medium">Не назначен</span>
                </button>

                {/* Список менеджеров */}
                {users.filter(user => user.role === 'manager' || user.role === 'engineer').map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      handleAssignUser(user.id)
                      setShowAssignModal(false)
                    }}
                    disabled={isAssigning}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                      application.assigned_to === user.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="font-medium">{user.full_name}</div>
                    <div className="text-sm text-gray-500">{user.role} • {user.email}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowAssignModal(false)}
                disabled={isAssigning}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Мастер привязки адреса */}
      {showAddressWizard && application && application.street_and_house && (
        <AddressLinkWizard
          applicationId={id}
          streetAndHouse={application.street_and_house}
          addressDetails={application.address_details}
          currentAddressId={application.address_id}
          onClose={() => setShowAddressWizard(false)}
          onLink={handleLinkAddress}
          onUnlink={handleUnlinkAddress}
        />
      )}
    </div>
  )
}
