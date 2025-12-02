'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Application, ApplicationStatus, Urgency, CustomerType, ServiceType, User } from '@/lib/types'
import StatusProgressBar from '@/app/components/StatusProgressBar'
import UserInfoModal from '@/app/components/UserInfoModal'
import AuditLog from '@/app/components/AuditLog'
import AuditLogModal from '@/app/components/AuditLogModal'
import Comments from '@/app/components/Comments'
import FileUpload from '@/app/components/FileUpload'
import FileList from '@/app/components/FileList'
import AddressLinkWizard from '@/app/components/AddressLinkWizard'
import { getCurrentUser } from '@/lib/auth-client'

interface InstallerProfile {
  id: string
  full_name: string
  email: string
  phone: string
  region: string
  node: string
  skills: string[]
  availability: string[]
  workload: number
  activeAssignments: number
}

// Расширенный тип для заявки с адресом
interface ApplicationWithAddress extends Application {
  zakaz_addresses: {
    id: string
    city: string
    street: string
    house: string
    building: string | null
    address: string
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
  contract: 'bg-cyan-100 text-cyan-800',
  design: 'bg-teal-100 text-teal-800',
  approval: 'bg-emerald-100 text-emerald-800',
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

const skillOptions = ['Оптика', 'Сварка', 'СКУД', 'Эл. часть', 'ЛВС/ВОЛС', 'ПНР']
const fallbackRegions = ['Москва', 'Санкт-Петербург', 'Нижний Новгород']
const fallbackNodes = ['Node-07', 'Node-12', 'Node-03', 'Node-21']
const availabilityTemplates = [
  ['Сегодня 10:00–14:00', 'Завтра 12:00–16:00', 'Чт 09:00–18:00'],
  ['Сегодня 13:00–18:00', 'Пт 10:00–15:00', 'Сб 09:00–13:00'],
  ['Завтра 09:00–17:00', 'Пт 12:00–18:00', 'Вс 10:00–14:00'],
]

export default function ApplicationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [application, setApplication] = useState<ApplicationWithAddress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
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
  const [showUserInfoModal, setShowUserInfoModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUserName, setSelectedUserName] = useState<string>('')
  const [installers, setInstallers] = useState<InstallerProfile[]>([])
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false)
  const [workOrderWindow, setWorkOrderWindow] = useState('Завтра 10:00–14:00')
  const [workOrderTitle, setWorkOrderTitle] = useState('Монтаж и пусконаладка')
  const [workOrderNote, setWorkOrderNote] = useState('')
  const [workOrderInstallers, setWorkOrderInstallers] = useState<string[]>([])
  const [workOrderError, setWorkOrderError] = useState('')
  const [workOrders, setWorkOrders] = useState<
    {
      id: string
      number: string
      window: string
      title: string
      installers: string[]
      note?: string
      fileName: string
      status: 'Сформирован' | 'В работе' | 'Завершен'
      createdAt: string
    }[]
  >([])

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

  useEffect(() => {
    if (!application?.id) return

    try {
      const saved = localStorage.getItem(`workOrders:${application.id}`)
      if (saved) {
        setWorkOrders(JSON.parse(saved))
      }
    } catch (error) {
      console.error('Не удалось загрузить сохраненные наряды', error)
    }
  }, [application?.id])

  useEffect(() => {
    if (!application?.id) return

    localStorage.setItem(`workOrders:${application.id}`, JSON.stringify(workOrders))
  }, [application?.id, workOrders])

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

      const installersFromApi = (data.users || []).filter(
        (user: { role: string }) => user.role === 'installer',
      )

      const enrichedInstallers: InstallerProfile[] = installersFromApi
        .filter(Boolean)
        .map(
          (
            user: {
              id: string
              full_name: string
              email: string
              phone?: string | null
              assigned_node?: string | null
            },
            index: number,
          ) => {
            const skills = [
              skillOptions[index % skillOptions.length],
              skillOptions[(index + 2) % skillOptions.length],
            ]

            return {
              id: user.id,
              full_name: user.full_name,
              email: user.email,
              phone: user.phone || '+7 (900) 000-00-00',
              region: fallbackRegions[index % fallbackRegions.length],
              node: user.assigned_node || fallbackNodes[index % fallbackNodes.length],
              skills,
              availability: availabilityTemplates[index % availabilityTemplates.length],
              workload: 20 + index * 8,
              activeAssignments: (index % 3) + 1,
            }
          },
        )

      setInstallers(enrichedInstallers)
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

  async function handleStatusChangeFromProgressBar(newStatus: ApplicationStatus) {
    try {
      console.log('Changing status to:', newStatus, 'by user:', currentUserId)

      const response = await fetch(`/api/applications/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_status: newStatus,
          changed_by: currentUserId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Status change error:', errorData)
        alert(`Не удалось изменить статус: ${errorData.error || 'Неизвестная ошибка'}`)
        return
      }

      // Перезагружаем данные заявки
      await loadApplication()
    } catch (error) {
      console.error('Error changing status:', error)
      alert(`Не удалось изменить статус: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
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
          address_match_status: 'manual_matched',
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
          address_match_status: 'unmatched',
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
    // Используем полный адрес, автоматически сформированный триггером БД
    return address.address || 'Адрес не указан'
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

  const commonSlots = useMemo(() => {
    if (workOrderInstallers.length === 0) return [] as string[]
    const selectedProfiles = installers.filter(profile => workOrderInstallers.includes(profile.id))

    const slotCounts = new Map<string, number>()
    selectedProfiles.forEach(profile => {
      profile.availability.forEach(slot => {
        slotCounts.set(slot, (slotCounts.get(slot) || 0) + 1)
      })
    })

    return Array.from(slotCounts.entries())
      .filter(([, count]) => count === selectedProfiles.length)
      .map(([slot]) => slot)
  }, [installers, workOrderInstallers])

  function toggleWorkOrderInstaller(installerId: string) {
    setWorkOrderError('')
    setWorkOrderInstallers(prev =>
      prev.includes(installerId)
        ? prev.filter(item => item !== installerId)
        : [...prev, installerId],
    )
  }

  function handleCreateWorkOrder() {
    if (!application) return
    if (workOrderInstallers.length === 0) {
      setWorkOrderError('Добавьте хотя бы одного монтажника для наряда')
      return
    }

    const newOrder = {
      id: `${Date.now()}`,
      number: `WR-${application.application_number}-${workOrders.length + 1}`,
      window: workOrderWindow || 'Окно не указано',
      title: workOrderTitle || 'Наряд на монтаж',
      installers: workOrderInstallers,
      note: workOrderNote,
      fileName: `Наряд_${application.application_number}_${workOrders.length + 1}.pdf`,
      status: 'Сформирован' as const,
      createdAt: new Date().toISOString(),
    }

    setWorkOrders(prev => [...prev, newOrder])
    setShowWorkOrderModal(false)
    setWorkOrderInstallers([])
    setWorkOrderNote('')
    setWorkOrderError('')
    setWorkOrderWindow('Завтра 10:00–14:00')
    setWorkOrderTitle('Монтаж и пусконаладка')
    setFileRefreshTrigger(prev => prev + 1)
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
            {/* Линейка прогресса статусов */}
            <StatusProgressBar
              currentStatus={application.status}
              onStatusChange={handleStatusChangeFromProgressBar}
              disabled={!currentUserId}
            />

            {/* Компактная карточка с основной информацией */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              {/* Основные данные в двухколоночном виде */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4 pb-4 border-b border-gray-200">
                {/* Первая колонка */}
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-500">Создана:</span>{' '}
                    {application.created_by_user ? (
                      <button
                        onClick={() => {
                          setSelectedUserId(application.created_by_user!.id)
                          setSelectedUserName(application.created_by_user!.full_name)
                          setShowUserInfoModal(true)
                        }}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition"
                      >
                        {application.created_by_user.full_name}
                      </button>
                    ) : (
                      <span className="font-medium text-gray-900">Неизвестен</span>
                    )}
                    <span className="text-gray-500"> ({formatDate(application.created_at)})</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Обновлена:</span>{' '}
                    {application.updated_by_user ? (
                      <button
                        onClick={() => {
                          setSelectedUserId(application.updated_by_user!.id)
                          setSelectedUserName(application.updated_by_user!.full_name)
                          setShowUserInfoModal(true)
                        }}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition"
                      >
                        {application.updated_by_user.full_name}
                      </button>
                    ) : (
                      <span className="font-medium text-gray-900">Неизвестен</span>
                    )}
                    <span className="text-gray-500"> ({formatDate(application.updated_at)})</span>
                  </div>
                </div>

                {/* Вторая колонка */}
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-500">Услуга:</span>{' '}
                    <span className="font-medium text-gray-900">{serviceTypeLabels[application.service_type]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Менеджер:</span>{' '}
                    {application.assigned_user ? (
                      <>
                        <button
                          onClick={() => {
                            setSelectedUserId(application.assigned_user!.id)
                            setSelectedUserName(application.assigned_user!.full_name)
                            setShowUserInfoModal(true)
                          }}
                          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition"
                        >
                          {application.assigned_user.full_name}
                        </button>
                        <button
                          onClick={() => setShowAssignModal(true)}
                          className="text-gray-400 hover:text-indigo-600 transition"
                          title="Изменить менеджера"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition"
                      >
                        Не назначен
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Адрес */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="space-y-2">
                  {/* Адрес заявки */}
                  <div className="flex justify-between items-start gap-3">
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
                  </div>

                  {/* Привязка к формализованному адресу */}
                  <div className="flex items-center gap-2">
                    {application.address_id && application.zakaz_addresses ? (
                      <>
                        <span className="text-xs text-gray-500">Формализованный адрес:</span>
                        <Link
                          href={`/dashboard/applications?address_id=${application.address_id}&address=${encodeURIComponent(application.zakaz_addresses.address)}`}
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition"
                        >
                          <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-medium text-green-700 hover:text-green-800">
                            {formatAddress(application.zakaz_addresses)}
                          </span>
                        </Link>
                        {application.street_and_house && (
                          <button
                            onClick={() => setShowAddressWizard(true)}
                            className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded transition"
                            title="Изменить привязку адреса"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-500">Статус:</span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 px-2 py-1 bg-amber-50 border border-amber-200 rounded">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Не привязан к формализованному адресу
                        </span>
                        {application.street_and_house && (
                          <button
                            onClick={() => setShowAddressWizard(true)}
                            className="text-xs px-3 py-1.5 rounded transition font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                          >
                            Привязать
                          </button>
                        )}
                      </>
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
                onUserClick={(userId, userName) => {
                  setSelectedUserId(userId)
                  setSelectedUserName(userName)
                  setShowUserInfoModal(true)
                }}
              />
            </div>
          </div>

          {/* Правая колонка - Задания, файлы и история */}
          <div className="lg:col-span-1 space-y-4">
            {/* Задания / Наряды */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                <h3 className="text-base font-bold text-gray-900">Задания</h3>
                <button
                  onClick={() => {
                    setShowWorkOrderModal(true)
                  }}
                  className="text-sm px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  Сформировать наряд
                </button>
              </div>

              {workOrders.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Наряды ещё не созданы. Сформируйте задание для монтажников по данному объекту.
                </p>
              ) : (
                <div className="space-y-3">
                  {workOrders.map(order => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-900">{order.number}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${
                            order.status === 'Сформирован'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : order.status === 'В работе'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-gray-700 space-y-1">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-12 8h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span>{order.window}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-medium text-gray-900">{order.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>
                            {order.installers
                              .map(installerId => installers.find(item => item.id === installerId)?.full_name || 'Исполнитель')
                              .join(', ')}
                          </span>
                        </div>
                        {order.note && <p className="text-xs text-gray-600">{order.note}</p>}
                        <div className="text-xs text-gray-500">Файл: {order.fileName} (будет прикреплён)</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                onUserClick={(userId, userName) => {
                  setSelectedUserId(userId)
                  setSelectedUserName(userName)
                  setShowUserInfoModal(true)
                }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Модальное окно полной истории */}
      {showAuditLogModal && (
        <AuditLogModal
          applicationId={id}
          onClose={() => setShowAuditLogModal(false)}
          onUserClick={(userId, userName) => {
            setSelectedUserId(userId)
            setSelectedUserName(userName)
            setShowUserInfoModal(true)
            setShowAuditLogModal(false)
          }}
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
                {users.filter(user => user.role === 'manager' || user.role === 'admin').map((user) => (
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

      {/* Модальное окно формирования наряда */}
      {showWorkOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Наряд на работы</h3>
                <p className="text-sm text-gray-600">Формирование задания для монтажников по объекту</p>
              </div>
              <button
                onClick={() => setShowWorkOrderModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
                aria-label="Закрыть"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Объект</p>
                  <p className="text-base font-semibold text-gray-900">{formatTitle()}</p>
                  {application?.zakaz_addresses && (
                    <p className="text-xs text-gray-600">Адрес: {application.zakaz_addresses.address}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-700 font-medium">Окно выполнения</label>
                  <input
                    value={workOrderWindow}
                    onChange={event => setWorkOrderWindow(event.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                    placeholder="Например: 12.03 10:00–14:00"
                  />
                  {commonSlots.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {commonSlots.slice(0, 3).map(slot => (
                        <button
                          key={slot}
                          onClick={() => setWorkOrderWindow(slot)}
                          className="px-2 py-1 rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
                          type="button"
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-700 font-medium">Что нужно сделать</label>
                  <input
                    value={workOrderTitle}
                    onChange={event => setWorkOrderTitle(event.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                    placeholder="Например: монтаж и сварка, установка коммутатора"
                  />
                  <textarea
                    value={workOrderNote}
                    onChange={event => setWorkOrderNote(event.target.value)}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm min-h-[90px]"
                    placeholder="Требования по доступу, материалы, контакты на объекте"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-700 font-medium">Исполнители</label>
                    <span className="text-xs text-gray-500">Выбрано: {workOrderInstallers.length}</span>
                  </div>
                  <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {installers.map(installer => (
                      <label key={installer.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={workOrderInstallers.includes(installer.id)}
                          onChange={() => toggleWorkOrderInstaller(installer.id)}
                          className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{installer.full_name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{installer.region}</span>
                          </div>
                          <p className="text-xs text-gray-600">{installer.skills.join(' • ')}</p>
                          <p className="text-xs text-gray-500">Доступность: {installer.availability[0]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {workOrderError && <p className="text-sm text-red-600">{workOrderError}</p>}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowWorkOrderModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateWorkOrder}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                Создать наряд и прикрепить
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
          currentNodeId={application.node_id}
          onClose={() => setShowAddressWizard(false)}
          onLink={handleLinkAddress}
          onUnlink={handleUnlinkAddress}
        />
      )}

      {/* Модальное окно информации о пользователе */}
      {showUserInfoModal && selectedUserId && (
        <UserInfoModal
          userId={selectedUserId}
          userName={selectedUserName}
          onClose={() => {
            setShowUserInfoModal(false)
            setSelectedUserId(null)
            setSelectedUserName('')
          }}
        />
      )}
    </div>
  )
}
