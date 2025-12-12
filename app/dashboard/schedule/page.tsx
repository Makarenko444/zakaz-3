'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { WorkOrderType, WorkOrderStatus } from '@/lib/types'

interface ScheduleWorkOrder {
  id: string
  work_order_number: number
  type: WorkOrderType
  status: WorkOrderStatus
  scheduled_date: string | null
  scheduled_time: string | null
  estimated_duration: string | null
  notes: string | null
  application?: {
    id: string
    application_number: number
    customer_fullname: string
    city: string
    street_and_house: string | null
    address_details: string | null
  }
  executors?: Array<{
    id: string
    user_id: string
    is_lead: boolean
    user?: { id: string; full_name: string; role: string }
  }>
}

const typeLabels: Record<WorkOrderType, string> = {
  survey: 'Осмотр',
  installation: 'Монтаж',
}

const typeColors: Record<WorkOrderType, string> = {
  survey: 'border-l-blue-500 bg-blue-50',
  installation: 'border-l-green-500 bg-green-50',
}

const statusColors: Record<WorkOrderStatus, string> = {
  draft: 'text-gray-500',
  assigned: 'text-yellow-600',
  in_progress: 'text-blue-600',
  completed: 'text-green-600',
  cancelled: 'text-red-600',
}

const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export default function SchedulePage() {
  const router = useRouter()
  const [view, setView] = useState<'day' | 'week'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workOrders, setWorkOrders] = useState<ScheduleWorkOrder[]>([])
  const [groupedByDate, setGroupedByDate] = useState<Record<string, ScheduleWorkOrder[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<WorkOrderType | ''>('')

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('view', view)
      params.set('date', currentDate.toISOString().split('T')[0])
      if (typeFilter) params.set('type', typeFilter)

      const res = await fetch(`/api/schedule?${params}`)
      const data = await res.json()

      if (res.ok) {
        setWorkOrders(data.schedule || [])
        setGroupedByDate(data.groupedByDate || {})
      }
    } catch (error) {
      console.error('Error fetching schedule:', error)
    } finally {
      setIsLoading(false)
    }
  }, [view, currentDate, typeFilter])

  useEffect(() => {
    fetchSchedule()
  }, [fetchSchedule])

  // Навигация по датам
  const goToday = () => setCurrentDate(new Date())

  const goPrev = () => {
    const newDate = new Date(currentDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() - 1)
    } else {
      newDate.setDate(newDate.getDate() - 7)
    }
    setCurrentDate(newDate)
  }

  const goNext = () => {
    const newDate = new Date(currentDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  // Получаем даты недели
  const getWeekDates = () => {
    const dates: Date[] = []
    const day = currentDate.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(currentDate)
    monday.setDate(currentDate.getDate() + mondayOffset)

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      dates.push(d)
    }
    return dates
  }

  const weekDates = view === 'week' ? getWeekDates() : [currentDate]

  const formatDateKey = (date: Date) => date.toISOString().split('T')[0]

  const isToday = (date: Date) => {
    const today = new Date()
    return formatDateKey(date) === formatDateKey(today)
  }

  // Заголовок периода
  const getPeriodTitle = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
    }
    const start = weekDates[0]
    const end = weekDates[6]
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} — ${end.getDate()} ${MONTHS_RU[start.getMonth()].toLowerCase()}`
    }
    return `${start.getDate()} ${MONTHS_RU[start.getMonth()].toLowerCase().slice(0, 3)} — ${end.getDate()} ${MONTHS_RU[end.getMonth()].toLowerCase().slice(0, 3)}`
  }

  return (
    <div className="p-6">
      {/* Заголовок */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Календарь нарядов</h1>
        <Link
          href="/dashboard/work-orders"
          className="text-indigo-600 hover:text-indigo-800"
        >
          Список нарядов →
        </Link>
      </div>

      {/* Панель управления */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          {/* Навигация */}
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
            >
              ←
            </button>
            <button
              onClick={goToday}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
            >
              Сегодня
            </button>
            <button
              onClick={goNext}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
            >
              →
            </button>
            <span className="ml-2 font-medium text-gray-900">{getPeriodTitle()}</span>
          </div>

          {/* Фильтры */}
          <div className="flex items-center gap-4">
            {/* Фильтр по типу */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as WorkOrderType | '')}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Все типы</option>
              <option value="survey">Осмотр и расчёт</option>
              <option value="installation">Монтаж</option>
            </select>

            {/* Переключатель вида */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setView('day')}
                className={`px-4 py-2 text-sm ${view === 'day' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                День
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-4 py-2 text-sm ${view === 'week' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                Неделя
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Календарь */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Заголовки дней */}
          <div className={`grid border-b ${view === 'week' ? 'grid-cols-7' : 'grid-cols-1'}`}>
            {weekDates.map((date, idx) => (
              <div
                key={idx}
                className={`p-3 text-center border-r last:border-r-0 ${
                  isToday(date) ? 'bg-indigo-50' : 'bg-gray-50'
                }`}
              >
                <div className="text-xs text-gray-500 uppercase">{DAYS_RU[idx % 7]}</div>
                <div className={`text-lg font-semibold ${isToday(date) ? 'text-indigo-600' : 'text-gray-900'}`}>
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Содержимое */}
          <div className={`grid min-h-[400px] ${view === 'week' ? 'grid-cols-7' : 'grid-cols-1'}`}>
            {weekDates.map((date, idx) => {
              const dateKey = formatDateKey(date)
              const dayWorkOrders = groupedByDate[dateKey] || []

              return (
                <div
                  key={idx}
                  className={`border-r last:border-r-0 p-2 ${
                    isToday(date) ? 'bg-indigo-50/30' : ''
                  }`}
                >
                  {dayWorkOrders.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-4">—</div>
                  ) : (
                    <div className="space-y-2">
                      {dayWorkOrders.map((wo) => (
                        <div
                          key={wo.id}
                          onClick={() => router.push(`/dashboard/work-orders/${wo.id}`)}
                          className={`border-l-4 rounded p-2 cursor-pointer hover:shadow transition-shadow ${typeColors[wo.type]}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-medium">
                              {wo.scheduled_time?.slice(0, 5) || '—'}
                            </span>
                            <span className={`text-xs ${statusColors[wo.status]}`}>●</span>
                          </div>
                          <div className="text-sm font-medium text-gray-900 truncate">
                            №{wo.work_order_number} {typeLabels[wo.type]}
                          </div>
                          {wo.application && (
                            <div className="text-xs text-gray-600 truncate mt-1">
                              {wo.application.street_and_house}
                            </div>
                          )}
                          {wo.executors && wo.executors.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              {wo.executors.map(e => e.user?.full_name?.split(' ')[0]).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Статистика */}
      <div className="mt-6 flex gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-500 rounded"></span>
          <span>Осмотр: {workOrders.filter(w => w.type === 'survey').length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500 rounded"></span>
          <span>Монтаж: {workOrders.filter(w => w.type === 'installation').length}</span>
        </div>
        <div className="ml-4">
          Всего: {workOrders.length} нарядов
        </div>
      </div>
    </div>
  )
}
