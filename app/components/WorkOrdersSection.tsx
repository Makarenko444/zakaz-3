'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { WorkOrder, WorkOrderType, WorkOrderStatus, User } from '@/lib/types'

interface WorkOrderWithDetails extends WorkOrder {
  executors?: Array<{
    id: string
    user_id: string
    is_lead: boolean
    user?: User
  }>
}

interface Props {
  applicationId: string
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
  draft: 'bg-gray-100 text-gray-700',
  assigned: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function WorkOrdersSection({ applicationId }: Props) {
  const router = useRouter()
  const [workOrders, setWorkOrders] = useState<WorkOrderWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [users, setUsers] = useState<User[]>([])

  const fetchWorkOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders?application_id=${applicationId}`)
      const data = await res.json()
      if (res.ok) {
        setWorkOrders(data.work_orders || [])
      }
    } catch (error) {
      console.error('Error fetching work orders:', error)
    } finally {
      setIsLoading(false)
    }
  }, [applicationId])

  const fetchUsers = async () => {
    const res = await fetch('/api/users?active=true')
    const data = await res.json()
    if (res.ok) setUsers(data.users || [])
  }

  useEffect(() => {
    fetchWorkOrders()
    fetchUsers()
  }, [fetchWorkOrders])

  const handleCreateWorkOrder = async (data: {
    type: WorkOrderType
    scheduled_date?: string
    scheduled_time?: string
    estimated_duration?: string
    notes?: string
    executors?: Array<{ user_id: string; is_lead: boolean }>
  }) => {
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          ...data,
        }),
      })

      if (res.ok) {
        setShowCreateModal(false)
        fetchWorkOrders()
      }
    } catch (error) {
      console.error('Error creating work order:', error)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-5 py-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Наряды</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Создать наряд
        </button>
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          </div>
        ) : workOrders.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Нарядов нет</p>
        ) : (
          <div className="space-y-3">
            {workOrders.map((wo) => (
              <div
                key={wo.id}
                onClick={() => router.push(`/dashboard/work-orders/${wo.id}`)}
                className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">№{wo.work_order_number}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeColors[wo.type]}`}>
                      {typeLabels[wo.type]}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[wo.status]}`}>
                    {statusLabels[wo.status]}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-600">
                  <div>
                    {wo.scheduled_date ? (
                      <span>{formatDate(wo.scheduled_date)} {wo.scheduled_time?.slice(0, 5)}</span>
                    ) : (
                      <span className="text-gray-400">Дата не назначена</span>
                    )}
                  </div>
                  <div>
                    {wo.executors && wo.executors.length > 0 ? (
                      <span className="text-gray-500">
                        {wo.executors.map(e => e.user?.full_name?.split(' ')[0]).join(', ')}
                      </span>
                    ) : (
                      <span className="text-gray-400">Нет исполнителей</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка создания наряда */}
      {showCreateModal && (
        <CreateWorkOrderModal
          users={users}
          onSubmit={handleCreateWorkOrder}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}

// Модалка создания наряда
function CreateWorkOrderModal({
  users,
  onSubmit,
  onClose,
}: {
  users: User[]
  onSubmit: (data: {
    type: WorkOrderType
    scheduled_date?: string
    scheduled_time?: string
    estimated_duration?: string
    notes?: string
    executors?: Array<{ user_id: string; is_lead: boolean }>
  }) => void
  onClose: () => void
}) {
  const [type, setType] = useState<WorkOrderType>('survey')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [estimatedDuration, setEstimatedDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedExecutors, setSelectedExecutors] = useState<Array<{ user_id: string; is_lead: boolean }>>([])

  const handleAddExecutor = (userId: string, isLead: boolean) => {
    if (selectedExecutors.find(e => e.user_id === userId)) return

    // Если назначаем бригадира, снимаем флаг с других
    if (isLead) {
      setSelectedExecutors(prev => [
        ...prev.map(e => ({ ...e, is_lead: false })),
        { user_id: userId, is_lead: true },
      ])
    } else {
      setSelectedExecutors(prev => [...prev, { user_id: userId, is_lead: false }])
    }
  }

  const handleRemoveExecutor = (userId: string) => {
    setSelectedExecutors(prev => prev.filter(e => e.user_id !== userId))
  }

  const handleSubmit = () => {
    onSubmit({
      type,
      scheduled_date: scheduledDate || undefined,
      scheduled_time: scheduledTime || undefined,
      estimated_duration: estimatedDuration || undefined,
      notes: notes || undefined,
      executors: selectedExecutors.length > 0 ? selectedExecutors : undefined,
    })
  }

  const availableUsers = users.filter(u => !selectedExecutors.find(e => e.user_id === u.id))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Создание наряда</h3>

        {/* Тип наряда */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Тип наряда *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WorkOrderType)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="survey">Осмотр и расчёт</option>
            <option value="installation">Монтаж</option>
          </select>
        </div>

        {/* Дата и время */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Время</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Длительность */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Ориентировочная длительность</label>
          <select
            value={estimatedDuration}
            onChange={(e) => setEstimatedDuration(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Не указано</option>
            <option value="1 hour">1 час</option>
            <option value="2 hours">2 часа</option>
            <option value="3 hours">3 часа</option>
            <option value="4 hours">4 часа</option>
            <option value="6 hours">6 часов</option>
            <option value="8 hours">8 часов (весь день)</option>
          </select>
        </div>

        {/* Исполнители */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Исполнители</label>

          {/* Выбранные */}
          {selectedExecutors.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedExecutors.map((ex) => {
                const user = users.find(u => u.id === ex.user_id)
                return (
                  <span
                    key={ex.user_id}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded ${
                      ex.is_lead ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {user?.full_name || '?'}
                    {ex.is_lead && ' (бригадир)'}
                    <button
                      type="button"
                      onClick={() => handleRemoveExecutor(ex.user_id)}
                      className="ml-1 text-gray-500 hover:text-red-500"
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* Добавление */}
          {availableUsers.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddExecutor(e.target.value, false)
                  e.target.value = ''
                }
              }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">+ Добавить исполнителя</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
              ))}
            </select>
          )}
        </div>

        {/* Примечания */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 h-20"
            placeholder="Примечания при выдаче наряда..."
          />
        </div>

        {/* Кнопки */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Создать наряд
          </button>
        </div>
      </div>
    </div>
  )
}
