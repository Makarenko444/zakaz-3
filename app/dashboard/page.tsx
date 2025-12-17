'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-client'
import { User } from '@/lib/types'

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
  managers: Array<{
    id: string
    name: string
    count: number
    activeCount: number
    isActive: boolean
  }>
  curators: Array<{
    id: string
    name: string
    count: number
    activeCount: number
    isActive: boolean
  }>
  users: Array<{
    id: string
    name: string
    role: string
    count: number
  }>
  statuses: Array<{
    status: string
    label: string
    count: number
  }>
  recentApplications: Array<{
    id: string
    application_number: string
    customer_fullname: string
    customer_phone: string
    service_type: string
    urgency: string
    status: string
    created_at: string
    street_and_house: string | null
  }>
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showActiveOnly, setShowActiveOnly] = useState(true) // Тумблер Активные/Все для менеджеров
  const [showCuratorsActiveOnly, setShowCuratorsActiveOnly] = useState(true) // Тумблер Активные/Все для кураторов

  useEffect(() => {
    async function loadData() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push('/login')
          return
        }
        setUser(currentUser)

        const response = await fetch('/api/dashboard/stats')
        if (response.ok) {
          const data = await response.json()
          console.log('Dashboard stats loaded:', data)
          setStats(data)
        } else {
          console.error('Failed to load stats:', response.status, response.statusText)
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

  const statusColors: Record<string, string> = {
    new: 'bg-gray-100 text-gray-800 border-gray-300',
    thinking: 'bg-blue-50 text-blue-700 border-blue-200',
    estimation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    estimation_done: 'bg-sky-50 text-sky-700 border-sky-200',
    waiting_payment: 'bg-amber-50 text-amber-700 border-amber-200',
    contract: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    design: 'bg-teal-50 text-teal-700 border-teal-200',
    approval: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    queue_install: 'bg-purple-50 text-purple-700 border-purple-200',
    install: 'bg-violet-50 text-violet-700 border-violet-200',
    installed: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    no_tech: 'bg-orange-50 text-orange-700 border-orange-200',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Приветствие */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Добро пожаловать, {user.full_name}!
          </h1>
          <p className="mt-1 text-gray-600">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Ключевые метрики */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div
            onClick={() => router.push('/dashboard/applications?status=new')}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Новые заявки</p>
                <p className="text-4xl font-bold text-gray-900 mt-2">{stats?.new ?? 0}</p>
              </div>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div
            onClick={() => router.push('/dashboard/applications')}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">В работе</p>
                <p className="text-4xl font-bold text-gray-900 mt-2">{stats?.inProgress ?? 0}</p>
              </div>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div
            onClick={() => router.push('/dashboard/applications?status=installed')}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Завершено</p>
                <p className="text-4xl font-bold text-gray-900 mt-2">{stats?.installed ?? 0}</p>
              </div>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div
            onClick={() => router.push('/dashboard/applications')}
            className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Всего заявок</p>
                <p className="text-4xl font-bold text-gray-900 mt-2">{stats?.total ?? 0}</p>
              </div>
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Заявки по статусам */}
        {stats && stats.statuses && stats.statuses.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Заявки по статусам</h2>
            <div className="flex flex-wrap gap-3">
              {/* Рабочие статусы */}
              {stats.statuses
                .filter(s => !['installed', 'rejected', 'no_tech'].includes(s.status))
                .map((statusItem) => (
                  <button
                    key={statusItem.status}
                    onClick={() => router.push(`/dashboard/applications?status=${statusItem.status}`)}
                    className={`flex-1 min-w-[100px] border-2 rounded-lg p-3 transition-all hover:scale-105 hover:shadow-md ${
                      statusColors[statusItem.status] || 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                    <div className="text-2xl font-bold mb-1">{statusItem.count}</div>
                    <div className="text-xs font-medium">{statusItem.label}</div>
                  </button>
                ))}
              {/* Завершающие статусы */}
              <div className="flex flex-col gap-2 min-w-[100px]">
                {/* Выполнено */}
                {stats.statuses.filter(s => s.status === 'installed').map((statusItem) => (
                  <button
                    key={statusItem.status}
                    onClick={() => router.push(`/dashboard/applications?status=${statusItem.status}`)}
                    className={`flex-1 border-2 rounded-lg p-3 transition-all hover:scale-105 hover:shadow-md ${
                      statusColors[statusItem.status] || 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                    <div className="text-2xl font-bold mb-1">{statusItem.count}</div>
                    <div className="text-xs font-medium">{statusItem.label}</div>
                  </button>
                ))}
                {/* Отказ и Нет возможности */}
                <div className="flex gap-2">
                  {stats.statuses
                    .filter(s => ['rejected', 'no_tech'].includes(s.status))
                    .map((statusItem) => (
                      <button
                        key={statusItem.status}
                        onClick={() => router.push(`/dashboard/applications?status=${statusItem.status}`)}
                        className={`flex-1 border-2 rounded-lg p-2 transition-all hover:scale-105 hover:shadow-md ${
                          statusColors[statusItem.status] || 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                        <div className="text-lg font-bold">{statusItem.count}</div>
                        <div className="text-xs font-medium leading-tight">{statusItem.label}</div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Менеджеры и Сотрудники в две колонки */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Заявки по менеджерам */}
          {stats && stats.managers && stats.managers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">Активные заявки по менеджерам</h2>
                {/* Тумблер Активные/Все */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setShowActiveOnly(true)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      showActiveOnly
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Активные
                  </button>
                  <button
                    onClick={() => setShowActiveOnly(false)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      !showActiveOnly
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Все
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200 max-h-80 overflow-y-auto">
                {stats.managers
                  .filter(m => showActiveOnly ? m.isActive : true)
                  .sort((a, b) => b.activeCount - a.activeCount)
                  .map((manager) => (
                  <button
                    key={manager.id}
                    onClick={() => {
                      if (manager.id === 'unassigned') {
                        router.push('/dashboard/applications?assigned_to=unassigned')
                      } else {
                        router.push(`/dashboard/applications?assigned_to=${manager.id}`)
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        manager.id === 'unassigned' ? 'bg-gray-400' : 'bg-gradient-to-br from-indigo-500 to-indigo-600'
                      }`}>
                        {manager.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
                        {manager.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900 group-hover:text-indigo-600">
                        {manager.activeCount}
                      </span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Заявки по техническим кураторам */}
          {stats && stats.curators && stats.curators.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">Активные заявки по кураторам</h2>
                {/* Тумблер Активные/Все */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setShowCuratorsActiveOnly(true)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      showCuratorsActiveOnly
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Активные
                  </button>
                  <button
                    onClick={() => setShowCuratorsActiveOnly(false)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      !showCuratorsActiveOnly
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Все
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200 max-h-80 overflow-y-auto">
                {stats.curators
                  .filter(c => showCuratorsActiveOnly ? c.isActive : true)
                  .sort((a, b) => b.activeCount - a.activeCount)
                  .map((curator) => (
                  <button
                    key={curator.id}
                    onClick={() => {
                      if (curator.id === 'unassigned') {
                        router.push('/dashboard/applications?technical_curator=unassigned')
                      } else {
                        router.push(`/dashboard/applications?technical_curator=${curator.id}`)
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        curator.id === 'unassigned' ? 'bg-gray-400' : 'bg-gradient-to-br from-teal-500 to-teal-600'
                      }`}>
                        {curator.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900 group-hover:text-teal-600">
                        {curator.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900 group-hover:text-teal-600">
                        {curator.activeCount}
                      </span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Последние заявки */}
        {stats && stats.recentApplications && stats.recentApplications.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Последние заявки</h2>
              <button
                onClick={() => router.push('/dashboard/applications')}
                className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold flex items-center gap-1">
                Смотреть все
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Заявка
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Клиент
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                        Адрес
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                        Статус
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дата
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.recentApplications.map((app) => {
                      const statusLabels: Record<string, string> = {
                        new: 'Новая',
                        thinking: 'Думает',
                        estimation: 'Расчёт',
                        estimation_done: 'Расчёт выполнен',
                        waiting_payment: 'Ожидание оплаты',
                        contract: 'Договор и оплата',
                        design: 'Проектирование',
                        approval: 'Согласование',
                        queue_install: 'Очередь на монтаж',
                        install: 'Монтаж',
                        installed: 'Выполнено',
                        rejected: 'Отказ',
                        no_tech: 'Нет возможности',
                      }

                      return (
                        <tr
                          key={app.id}
                          onClick={() => router.push(`/dashboard/applications/${app.id}`)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-indigo-600">№{app.application_number}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{app.customer_fullname}</div>
                            <div className="text-xs text-gray-500">{app.customer_phone}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                            <div className="text-sm text-gray-900 max-w-xs truncate">
                              {app.street_and_house || 'Адрес не указан'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                              statusColors[app.status] || 'bg-gray-100 text-gray-800 border-gray-300'
                            }`}>
                              {statusLabels[app.status] || app.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
          </div>
        )}
      </div>
    </div>
  )
}
