'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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

interface EmployeeWorkload {
  id: string
  name: string
  hours: number
  count: number
}

interface DayViewEmployee {
  id: string
  name: string
  workOrders: ScheduleWorkOrder[]
}

interface TimeSlot {
  workOrder: ScheduleWorkOrder
  startMinutes: number
  endMinutes: number
  row: number // для обработки нахлеста
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

// Форматирование даты в ключ YYYY-MM-DD
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Парсинг длительности в часы
function parseDurationToHours(duration: string | null): number {
  if (!duration) return 0
  const parts = duration.split(':')
  if (parts.length >= 2) {
    const hours = parseInt(parts[0]) || 0
    const minutes = parseInt(parts[1]) || 0
    return hours + minutes / 60
  }
  return 0
}

// Форматирование часов
function formatHours(hours: number): string {
  if (hours === 0) return '0ч'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}ч`
  return `${h}ч ${m}м`
}

// Парсинг времени в минуты от полуночи
function parseTimeToMinutes(time: string | null): number {
  if (!time) return 8 * 60 // по умолчанию 8:00
  const parts = time.split(':')
  const hours = parseInt(parts[0]) || 8
  const minutes = parseInt(parts[1]) || 0
  return hours * 60 + minutes
}

// Парсинг длительности в минуты
function parseDurationToMinutes(duration: string | null): number {
  if (!duration) return 60 // по умолчанию 1 час
  const parts = duration.split(':')
  const hours = parseInt(parts[0]) || 0
  const minutes = parseInt(parts[1]) || 0
  return hours * 60 + minutes
}

// Рассчитать нахлесты и распределить по строкам
function calculateOverlapRows(slots: TimeSlot[]): TimeSlot[] {
  // Сортируем по времени начала
  const sorted = [...slots].sort((a, b) => a.startMinutes - b.startMinutes)

  // Для каждого слота находим свободную строку
  sorted.forEach((slot, idx) => {
    const occupiedRows = new Set<number>()

    // Проверяем пересечения с предыдущими
    for (let i = 0; i < idx; i++) {
      const prev = sorted[i]
      // Если есть пересечение
      if (prev.endMinutes > slot.startMinutes && prev.startMinutes < slot.endMinutes) {
        occupiedRows.add(prev.row)
      }
    }

    // Находим первую свободную строку
    let row = 0
    while (occupiedRows.has(row)) {
      row++
    }
    slot.row = row
  })

  return sorted
}

export default function SchedulePage() {
  const router = useRouter()
  const [view, setView] = useState<'day' | 'week'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workOrders, setWorkOrders] = useState<ScheduleWorkOrder[]>([])
  const [groupedByDate, setGroupedByDate] = useState<Record<string, ScheduleWorkOrder[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<WorkOrderType | ''>('')
  const [showWorkloadChart, setShowWorkloadChart] = useState(true)
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

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('view', view)
      params.set('date', currentDate.toISOString().split('T')[0])
      if (typeFilter) params.set('type', typeFilter)
      if (myOnly && currentUserId) params.set('executor_id', currentUserId)

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
  }, [view, currentDate, typeFilter, myOnly, currentUserId])

  useEffect(() => {
    fetchSchedule()
  }, [fetchSchedule])

  // Расчёт общей загрузки и загрузки по сотрудникам
  const { totalHours, employeeWorkload, maxHours } = useMemo(() => {
    let total = 0
    const employeeMap = new Map<string, EmployeeWorkload>()

    workOrders.forEach(wo => {
      const hours = parseDurationToHours(wo.estimated_duration)
      total += hours

      // Распределяем часы по исполнителям
      if (wo.executors && wo.executors.length > 0) {
        const hoursPerExecutor = hours / wo.executors.length
        wo.executors.forEach(exec => {
          if (exec.user) {
            const existing = employeeMap.get(exec.user.id)
            if (existing) {
              existing.hours += hoursPerExecutor
              existing.count += 1
            } else {
              employeeMap.set(exec.user.id, {
                id: exec.user.id,
                name: exec.user.full_name,
                hours: hoursPerExecutor,
                count: 1,
              })
            }
          }
        })
      }
    })

    const workload = Array.from(employeeMap.values()).sort((a, b) => b.hours - a.hours)
    const max = workload.length > 0 ? Math.max(...workload.map(e => e.hours)) : 0

    return { totalHours: total, employeeWorkload: workload, maxHours: max }
  }, [workOrders])

  // Данные для дневного вида с временной шкалой
  const dayViewData = useMemo(() => {
    if (view !== 'day') return { employees: [], startHour: 8, endHour: 19 }

    const dateKey = formatDateKey(currentDate)
    const dayOrders = groupedByDate[dateKey] || []

    // Группируем по сотрудникам
    const employeeMap = new Map<string, DayViewEmployee>()

    // Также собираем заказы без исполнителей
    const unassigned: ScheduleWorkOrder[] = []

    dayOrders.forEach(wo => {
      if (wo.executors && wo.executors.length > 0) {
        wo.executors.forEach(exec => {
          if (exec.user) {
            const existing = employeeMap.get(exec.user.id)
            if (existing) {
              // Проверяем что этого заказа еще нет
              if (!existing.workOrders.find(w => w.id === wo.id)) {
                existing.workOrders.push(wo)
              }
            } else {
              employeeMap.set(exec.user.id, {
                id: exec.user.id,
                name: exec.user.full_name,
                workOrders: [wo]
              })
            }
          }
        })
      } else {
        unassigned.push(wo)
      }
    })

    // Определяем диапазон времени
    let minMinutes = 8 * 60 // 8:00
    let maxMinutes = 19 * 60 // 19:00

    dayOrders.forEach(wo => {
      const start = parseTimeToMinutes(wo.scheduled_time)
      const duration = parseDurationToMinutes(wo.estimated_duration)
      const end = start + duration

      if (start < minMinutes) minMinutes = start
      if (end > maxMinutes) maxMinutes = end
    })

    // Округляем до целых часов
    const startHour = Math.floor(minMinutes / 60)
    const endHour = Math.ceil(maxMinutes / 60)

    // Преобразуем в массив и добавляем нераспределенных
    const employees = Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name))

    if (unassigned.length > 0) {
      employees.push({
        id: 'unassigned',
        name: 'Не назначено',
        workOrders: unassigned
      })
    }

    return { employees, startHour, endHour }
  }, [view, currentDate, groupedByDate])

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

  // Расчёт загрузки по дню
  const getDayWorkload = (dateKey: string) => {
    const dayOrders = groupedByDate[dateKey] || []
    return dayOrders.reduce((sum, wo) => sum + parseDurationToHours(wo.estimated_duration), 0)
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
            {/* Тумблер "Мои наряды" */}
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={myOnly}
                  onChange={(e) => setMyOnly(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${myOnly ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${myOnly ? 'translate-x-4' : ''}`}></div>
              </div>
              <span className="text-sm text-gray-700">Мои наряды</span>
            </label>

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
      ) : view === 'day' ? (
        /* ==================== ВИД НА ДЕНЬ С ВРЕМЕННОЙ ШКАЛОЙ ==================== */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Заголовок временной шкалы */}
          <div className="flex border-b">
            {/* Колонка с именами сотрудников */}
            <div className="w-40 flex-shrink-0 p-3 bg-gray-50 border-r font-medium text-gray-700">
              Сотрудник
            </div>
            {/* Временные метки */}
            <div className="flex-1 flex">
              {Array.from({ length: dayViewData.endHour - dayViewData.startHour }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 p-2 text-center text-xs text-gray-500 border-r last:border-r-0 bg-gray-50"
                  style={{ minWidth: '60px' }}
                >
                  {dayViewData.startHour + i}:00
                </div>
              ))}
            </div>
          </div>

          {/* Строки сотрудников */}
          {dayViewData.employees.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              На этот день нет запланированных нарядов
            </div>
          ) : (
            dayViewData.employees.map((employee) => {
              // Подготовим слоты для этого сотрудника
              const slots: TimeSlot[] = employee.workOrders.map(wo => ({
                workOrder: wo,
                startMinutes: parseTimeToMinutes(wo.scheduled_time),
                endMinutes: parseTimeToMinutes(wo.scheduled_time) + parseDurationToMinutes(wo.estimated_duration),
                row: 0
              }))

              // Расчёт нахлестов
              const calculatedSlots = calculateOverlapRows(slots)
              const maxRow = Math.max(0, ...calculatedSlots.map(s => s.row))
              const rowHeight = 48 // пикселей на ряд
              const totalHeight = (maxRow + 1) * rowHeight

              const timelineStart = dayViewData.startHour * 60
              const timelineEnd = dayViewData.endHour * 60
              const timelineWidth = timelineEnd - timelineStart

              return (
                <div key={employee.id} className="flex border-b last:border-b-0">
                  {/* Имя сотрудника */}
                  <div className={`w-40 flex-shrink-0 p-3 border-r text-sm font-medium flex items-center ${
                    employee.id === 'unassigned' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
                  }`}>
                    <span className="truncate">{employee.name}</span>
                  </div>

                  {/* Временная шкала с задачами */}
                  <div
                    className="flex-1 relative"
                    style={{ minHeight: `${Math.max(totalHeight, rowHeight)}px` }}
                  >
                    {/* Вертикальные линии часов */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {Array.from({ length: dayViewData.endHour - dayViewData.startHour }, (_, i) => (
                        <div
                          key={i}
                          className="flex-1 border-r border-gray-100"
                          style={{ minWidth: '60px' }}
                        />
                      ))}
                    </div>

                    {/* Задачи */}
                    {calculatedSlots.map((slot) => {
                      const leftPercent = ((slot.startMinutes - timelineStart) / timelineWidth) * 100
                      const widthPercent = ((slot.endMinutes - slot.startMinutes) / timelineWidth) * 100
                      const wo = slot.workOrder
                      const bgColor = wo.type === 'survey' ? 'bg-blue-100 border-blue-400' : 'bg-green-100 border-green-400'

                      return (
                        <div
                          key={wo.id}
                          onClick={() => router.push(`/dashboard/work-orders/${wo.id}`)}
                          className={`absolute border-l-4 rounded px-2 py-1 cursor-pointer hover:shadow-md transition-shadow overflow-hidden ${bgColor}`}
                          style={{
                            left: `${leftPercent}%`,
                            width: `${Math.max(widthPercent, 3)}%`,
                            top: `${slot.row * rowHeight + 4}px`,
                            height: `${rowHeight - 8}px`,
                          }}
                          title={`№${wo.work_order_number} ${typeLabels[wo.type]} - ${wo.scheduled_time?.slice(0, 5) || '—'} (${formatHours(parseDurationToHours(wo.estimated_duration))})`}
                        >
                          <div className="flex items-center gap-1 h-full">
                            <span className={`text-xs ${statusColors[wo.status]}`}>●</span>
                            <span className="text-xs font-medium truncate">
                              №{wo.work_order_number}
                            </span>
                            <span className="text-xs text-gray-600 truncate hidden sm:inline">
                              {wo.application?.street_and_house}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* ==================== ВИД НА НЕДЕЛЮ ==================== */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Заголовки дней */}
          <div className="grid grid-cols-7 border-b">
            {weekDates.map((date, idx) => {
              const dateKey = formatDateKey(date)
              const dayHours = getDayWorkload(dateKey)
              return (
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
                  {dayHours > 0 && (
                    <div className="text-xs text-gray-500 mt-1">{formatHours(dayHours)}</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Содержимое */}
          <div className="grid grid-cols-7 min-h-[400px]">
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
                      {dayWorkOrders.map((wo) => {
                        const hours = parseDurationToHours(wo.estimated_duration)
                        return (
                          <div
                            key={wo.id}
                            onClick={() => router.push(`/dashboard/work-orders/${wo.id}`)}
                            className={`border-l-4 rounded p-2 cursor-pointer hover:shadow transition-shadow ${typeColors[wo.type]}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-medium">
                                {wo.scheduled_time?.slice(0, 5) || '—'}
                              </span>
                              <div className="flex items-center gap-1">
                                {hours > 0 && (
                                  <span className="text-xs text-gray-500 bg-white/70 px-1 rounded">
                                    {formatHours(hours)}
                                  </span>
                                )}
                                <span className={`text-xs ${statusColors[wo.status]}`}>●</span>
                              </div>
                            </div>
                            {/* Визуальный индикатор длительности */}
                            {hours > 0 && (
                              <div className="h-1 bg-gray-200 rounded-full mb-1 overflow-hidden">
                                <div
                                  className="h-full bg-current opacity-40 rounded-full"
                                  style={{ width: `${Math.min(hours / 8 * 100, 100)}%` }}
                                />
                              </div>
                            )}
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
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Статистика и загрузка */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Общая статистика */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Общая статистика</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{workOrders.length}</div>
              <div className="text-sm text-gray-500">нарядов</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">{formatHours(totalHours)}</div>
              <div className="text-sm text-gray-500">запланировано</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">{workOrders.filter(w => w.type === 'survey').length}</div>
              <div className="text-sm text-blue-600">осмотров</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-xl font-bold text-green-600">{workOrders.filter(w => w.type === 'installation').length}</div>
              <div className="text-sm text-green-600">монтажей</div>
            </div>
          </div>
        </div>

        {/* График загруженности по сотрудникам */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">Загрузка по сотрудникам</h3>
            <button
              onClick={() => setShowWorkloadChart(!showWorkloadChart)}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              {showWorkloadChart ? 'Скрыть' : 'Показать'}
            </button>
          </div>

          {showWorkloadChart && (
            <>
              {employeeWorkload.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  Нет данных о загрузке
                </div>
              ) : (
                <div className="space-y-3">
                  {employeeWorkload.map((emp) => (
                    <div key={emp.id} className="relative">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-700 truncate flex-1">{emp.name}</span>
                        <span className="text-sm font-medium text-gray-900 ml-2">
                          {formatHours(emp.hours)} ({emp.count})
                        </span>
                      </div>
                      {/* Полоса загрузки */}
                      <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                          style={{ width: maxHours > 0 ? `${Math.max((emp.hours / maxHours) * 100, 5)}%` : '5%' }}
                        >
                          {emp.hours >= maxHours * 0.3 && (
                            <span className="text-xs text-white font-medium">{formatHours(emp.hours)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
