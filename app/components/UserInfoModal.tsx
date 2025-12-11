'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ApplicationStatus, Urgency, ServiceType } from '@/lib/types'

interface UserInfo {
  id: string
  full_name: string
  email: string
  role: string
  phone?: string
}

interface ApplicationItem {
  id: string
  application_number: string
  status: ApplicationStatus
  urgency: Urgency
  service_type: ServiceType
  street_and_house: string | null
  address_details: string | null
  created_at: string
  zakaz_nodes: {
    id: string
    code: string
    presence_type: string
  } | null
  zakaz_addresses: {
    id: string
    city: string | null
    street: string | null
    house: string | null
    building: string | null
    address: string
  } | null
}

interface UserInfoModalProps {
  userId: string
  userName: string
  onClose: () => void
}

const statusColors: Record<ApplicationStatus, string> = {
  new: 'bg-gray-100 text-gray-800',
  thinking: 'bg-blue-100 text-blue-800',
  estimation: 'bg-indigo-100 text-indigo-800',
  estimation_done: 'bg-sky-100 text-sky-800',
  contract: 'bg-cyan-100 text-cyan-800',
  design: 'bg-teal-100 text-teal-800',
  approval: 'bg-emerald-100 text-emerald-800',
  queue_install: 'bg-purple-100 text-purple-800',
  install: 'bg-violet-100 text-violet-800',
  installed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  no_tech: 'bg-orange-100 text-orange-800',
}

// Цвета срочности (пока не используются, но могут понадобиться)
// const urgencyColors: Record<Urgency, string> = {
//   low: 'text-gray-600',
//   normal: 'text-blue-600',
//   high: 'text-orange-600',
//   critical: 'text-red-600',
// }

const roleLabels: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  engineer: 'Инженер',
  installer: 'Монтажник',
  supply: 'Снабжение',
}

export default function UserInfoModal({ userId, userName, onClose }: UserInfoModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [createdApplications, setCreatedApplications] = useState<ApplicationItem[]>([])
  const [assignedApplications, setAssignedApplications] = useState<ApplicationItem[]>([])
  const [statistics, setStatistics] = useState({
    createdCount: 0,
    assignedCount: 0,
    commentsCount: 0,
  })
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'created' | 'assigned'>('created')

  useEffect(() => {
    loadUserData()
    loadStatuses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function loadStatuses() {
    try {
      const response = await fetch('/api/statuses')
      if (!response.ok) throw new Error('Failed to load statuses')

      const data = await response.json()
      const labels: Record<string, string> = {}
      data.statuses.forEach((status: { code: string; name_ru: string }) => {
        labels[status.code] = status.name_ru
      })
      setStatusLabels(labels)
    } catch (error) {
      console.error('Error loading statuses:', error)
      setStatusLabels({
        new: 'Новая',
        thinking: 'Думает',
        estimation: 'Расчёт',
        contract: 'Договор и оплата',
        design: 'Проектирование',
        approval: 'Согласование',
        queue_install: 'Очередь на монтаж',
        install: 'Монтаж',
        installed: 'Выполнено',
        rejected: 'Отказ',
        no_tech: 'Нет тех. возможности',
      })
    }
  }

  async function loadUserData() {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/users/${userId}/applications`)
      if (!response.ok) {
        throw new Error('Failed to load user data')
      }

      const data = await response.json()
      setUser(data.user)
      setCreatedApplications(data.createdApplications)
      setAssignedApplications(data.assignedApplications)
      setStatistics(data.statistics)
    } catch (error) {
      console.error('Error loading user data:', error)
      setError('Не удалось загрузить данные пользователя')
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
    })
  }

  const formatAddress = (app: ApplicationItem) => {
    // Приоритет: адрес из заявки, затем формализованный адрес
    if (app.street_and_house) {
      return app.street_and_house
    }
    if (app.zakaz_addresses) {
      return app.zakaz_addresses.address || `${app.zakaz_addresses.street}, ${app.zakaz_addresses.house}`
    }
    return 'Адрес не указан'
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{userName}</h2>
            {user && (
              <p className="text-sm text-gray-500 mt-1">
                {roleLabels[user.role] || user.role} • {user.email}
                {user.phone && ` • ${user.phone}`}
              </p>
            )}
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
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-600">{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{statistics.createdCount}</p>
                  <p className="text-sm text-gray-600 mt-1">Создано заявок</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">{statistics.assignedCount}</p>
                  <p className="text-sm text-gray-600 mt-1">Назначено заявок</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{statistics.commentsCount}</p>
                  <p className="text-sm text-gray-600 mt-1">Комментариев</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('created')}
                    className={`pb-3 px-1 font-medium text-sm border-b-2 transition ${
                      activeTab === 'created'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Создал ({createdApplications.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('assigned')}
                    className={`pb-3 px-1 font-medium text-sm border-b-2 transition ${
                      activeTab === 'assigned'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Назначено ({assignedApplications.length})
                  </button>
                </div>
              </div>

              {/* Applications list */}
              <div className="space-y-3">
                {activeTab === 'created' && createdApplications.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Нет созданных заявок</p>
                )}
                {activeTab === 'assigned' && assignedApplications.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Нет назначенных заявок</p>
                )}

                {(activeTab === 'created' ? createdApplications : assignedApplications).map((app) => (
                  <Link
                    key={app.id}
                    href={`/dashboard/applications/${app.id}`}
                    className="block bg-gray-50 hover:bg-gray-100 rounded-lg p-4 transition border border-gray-200 hover:border-gray-300"
                    onClick={onClose}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-900">№{app.application_number}</span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[app.status]}`}>
                            {statusLabels[app.status] || app.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 truncate">{formatAddress(app)}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(app.created_at)}</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
