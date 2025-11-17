'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-client'
import { User } from '@/lib/types'

const roleNames: Record<string, string> = {
  admin: 'Администратор',
  operator: 'Оператор',
  engineer: 'Инженер',
  lead: 'Бригадир',
}

interface DashboardStats {
  total: number
  new: number
  inProgress: number
  installed: number
  rejected: number
  urgency: {
    critical: number
    high: number
    normal: number
    low: number
  }
  serviceType: {
    apartment: number
    office: number
    scs: number
  }
  customerType: {
    individual: number
    business: number
  }
  recentApplications: Array<{
    id: string
    application_number: string
    customer_fullname: string
    customer_phone: string
    service_type: string
    urgency: string
    status: string
    created_at: string
    zakaz_addresses: {
      street: string
      house: string
      entrance: string | null
    } | null
  }>
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push('/login')
          return
        }
        setUser(currentUser)

        // Загружаем статистику дашборда
        const response = await fetch('/api/dashboard/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        } else {
          console.error('Failed to load dashboard stats')
        }
      } catch (error: unknown) {
        console.error('Error loading data:', error)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [router])

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

  if (!user) {
    return null
  }

  return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Добро пожаловать, {user.full_name}!
          </h2>
          <p className="text-gray-600">
            Роль: {roleNames[user.role]} • Email: {user.email}
          </p>
        </div>

        {/* Dashboard Cards - Основная статистика */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/applications?status=new')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Новые заявки</h3>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                new
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats?.new ?? 0}</p>
            <p className="text-xs text-gray-500 mt-2">Требуют обработки</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/applications')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">В работе</h3>
              <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                active
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats?.inProgress ?? 0}</p>
            <p className="text-xs text-gray-500 mt-2">В процессе выполнения</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/applications?status=installed')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Завершено</h3>
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                done
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats?.installed ?? 0}</p>
            <p className="text-xs text-gray-500 mt-2">Успешно выполнено</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/applications')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">Всего заявок</h3>
              <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                total
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats?.total ?? 0}</p>
            <p className="text-xs text-gray-500 mt-2">За всё время</p>
          </div>
        </div>

        {/* Дополнительная статистика */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* Статистика по срочности */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">По срочности</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">Критичные</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.urgency.critical ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">Высокие</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.urgency.high ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">Обычные</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.urgency.normal ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  <span className="text-sm text-gray-600">Низкие</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.urgency.low ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Статистика по типам услуг */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">По типам услуг</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-indigo-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">Квартиры</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.serviceType.apartment ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">Офисы</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.serviceType.office ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-cyan-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">СКС</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.serviceType.scs ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Статистика по типам клиентов */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">По типам клиентов</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">Физ. лица</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.customerType.individual ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                  <span className="text-sm text-gray-600">Юр. лица</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.customerType.business ?? 0}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600 font-medium">Отклонено</span>
                <span className="text-lg font-bold text-red-600">{stats?.rejected ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Быстрые действия</h3>
          <div className={`grid grid-cols-1 ${user.role === 'admin' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
            <button
              onClick={() => router.push('/dashboard/applications/new')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Создать заявку
            </button>
            <button
              onClick={() => router.push('/dashboard/applications')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Все заявки
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Бригады
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => router.push('/dashboard/admin')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Администрирование
              </button>
            )}
          </div>
        </div>

        {/* Последние заявки */}
        {stats && stats.recentApplications && stats.recentApplications.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Последние заявки</h3>
              <button
                onClick={() => router.push('/dashboard/applications')}
                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
                Смотреть все →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Номер
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Клиент
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Адрес
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Тип услуги
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Срочность
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentApplications.map((app) => {
                    const urgencyColors = {
                      critical: 'bg-red-100 text-red-800',
                      high: 'bg-orange-100 text-orange-800',
                      normal: 'bg-blue-100 text-blue-800',
                      low: 'bg-gray-100 text-gray-800',
                    }

                    const urgencyLabels = {
                      critical: 'Критично',
                      high: 'Высокая',
                      normal: 'Обычная',
                      low: 'Низкая',
                    }

                    const statusColors = {
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

                    const statusLabels = {
                      new: 'Новая',
                      thinking: 'Думает',
                      estimation: 'Расчёт',
                      waiting_payment: 'Ожидание оплаты',
                      contract: 'Договор',
                      queue_install: 'Очередь на монтаж',
                      install: 'Монтаж',
                      installed: 'Выполнено',
                      rejected: 'Отказ',
                      no_tech: 'Нет возможности',
                    }

                    const serviceTypeLabels = {
                      apartment: 'Квартира',
                      office: 'Офис',
                      scs: 'СКС',
                    }

                    return (
                      <tr
                        key={app.id}
                        onClick={() => router.push(`/dashboard/applications/${app.id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-indigo-600">
                          #{app.application_number}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{app.customer_fullname}</div>
                          <div className="text-sm text-gray-500">{app.customer_phone}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {app.zakaz_addresses
                              ? `${app.zakaz_addresses.street}, ${app.zakaz_addresses.house}`
                              : 'Адрес не указан'}
                          </div>
                          {app.zakaz_addresses?.entrance && (
                            <div className="text-sm text-gray-500">Подъезд {app.zakaz_addresses.entrance}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {serviceTypeLabels[app.service_type as keyof typeof serviceTypeLabels] || app.service_type}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              urgencyColors[app.urgency as keyof typeof urgencyColors] || urgencyColors.normal
                            }`}>
                            {urgencyLabels[app.urgency as keyof typeof urgencyLabels] || app.urgency}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              statusColors[app.status as keyof typeof statusColors] || statusColors.new
                            }`}>
                            {statusLabels[app.status as keyof typeof statusLabels] || app.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(app.created_at).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
  )
}
