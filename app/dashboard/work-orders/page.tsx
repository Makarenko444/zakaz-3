'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { WorkOrder, WorkOrderType, WorkOrderStatus, User } from '@/lib/types'

interface WorkOrderWithDetails extends WorkOrder {
  application?: {
    id: string
    application_number: number
    customer_fullname: string
    customer_phone: string
    city: string
    street_and_house: string | null
    address_details: string | null
    service_type: string
  }
  executors?: Array<{
    id: string
    user_id: string
    is_lead: boolean
    user?: User
  }>
}

const typeLabels: Record<WorkOrderType, string> = {
  survey: 'Осмотр и расчёт',
  installation: 'Монтаж',
}

const typeColors: Record<WorkOrderType, string> = {
  survey: 'bg-blue-100 text-blue-800',
  installation: 'bg-green-100 text-green-800',
}

const statusLabels: Record<WorkOrderStatus, string> = {
  draft: 'Черновик',
  assigned: 'Выдан',
  in_progress: 'В работе',
  completed: 'Выполнен',
  cancelled: 'Отменён',
}

const statusColors: Record<WorkOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  assigned: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function WorkOrdersPage() {
  const router = useRouter()
  const [workOrders, setWorkOrders] = useState<WorkOrderWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  // Фильтры
  const [typeFilter, setTypeFilter] = useState<WorkOrderType | ''>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [myOnly, setMyOnly] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Получить текущего пользователя
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('/api/auth/session')
        const data = await res.json()
        if (res.ok && data.user) {
          setCurrentUserId(data.user.id)
        }
      } catch (error) {
        console.error('Error fetching current user:', error)
      }
    }
    fetchCurrentUser()
  }, [])

  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (myOnly && currentUserId) params.set('executor_id', currentUserId)

      const res = await fetch(`/api/work-orders?${params}`)
      const data = await res.json()

      if (res.ok) {
        setWorkOrders(data.work_orders || [])
        setTotal(data.total || 0)
      }
    } catch (error) {
      console.error('Error fetching work orders:', error)
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, typeFilter, statusFilter, dateFrom, dateTo, myOnly, currentUserId])

  useEffect(() => {
    fetchWorkOrders()
  }, [fetchWorkOrders])

  const totalPages = Math.ceil(total / limit)

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('ru-RU')
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return ''
    return timeStr.slice(0, 5)
  }

  return (
    <div className="p-6">
      {/* Заголовок */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Наряды</h1>
        <Link
          href="/dashboard/schedule"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Календарь
        </Link>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        {/* Тумблер "Мои наряды" */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={myOnly}
                onChange={(e) => { setMyOnly(e.target.checked); setPage(1) }}
                className="sr-only"
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${myOnly ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
              <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${myOnly ? 'translate-x-4' : ''}`}></div>
            </div>
            <span className="text-sm font-medium text-gray-700">Только мои наряды</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as WorkOrderType | ''); setPage(1) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Все типы</option>
              <option value="survey">Осмотр и расчёт</option>
              <option value="installation">Монтаж</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Все статусы</option>
              <option value="draft">Черновик</option>
              <option value="assigned">Выдан</option>
              <option value="in_progress">В работе</option>
              <option value="completed">Выполнен</option>
              <option value="cancelled">Отменён</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата с</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата по</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {(typeFilter || statusFilter || dateFrom || dateTo || myOnly) && (
          <button
            onClick={() => { setTypeFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setMyOnly(false); setPage(1) }}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-800"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {/* Список нарядов */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : workOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          Наряды не найдены
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">№</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Заявка</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Адрес</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Исполнители</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {workOrders.map((wo) => (
                <tr
                  key={wo.id}
                  onClick={() => router.push(`/dashboard/work-orders/${wo.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {wo.work_order_number}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColors[wo.type]}`}>
                      {typeLabels[wo.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[wo.status]}`}>
                      {statusLabels[wo.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {wo.application ? (
                      <Link
                        href={`/dashboard/applications/${wo.application.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        №{wo.application.application_number}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {wo.application?.street_and_house || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(wo.scheduled_date)}
                    {wo.scheduled_time && ` ${formatTime(wo.scheduled_time)}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {wo.executors && wo.executors.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {wo.executors.slice(0, 2).map((ex) => (
                          <span
                            key={ex.id}
                            className={`px-2 py-0.5 text-xs rounded ${ex.is_lead ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}
                          >
                            {ex.user?.full_name?.split(' ')[0] || '?'}
                          </span>
                        ))}
                        {wo.executors.length > 2 && (
                          <span className="text-xs text-gray-500">+{wo.executors.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            ←
          </button>
          <span className="px-3 py-1">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            →
          </button>
        </div>
      )}

      {/* Итого */}
      <div className="mt-4 text-sm text-gray-500 text-center">
        Всего: {total} нарядов
      </div>
    </div>
  )
}
