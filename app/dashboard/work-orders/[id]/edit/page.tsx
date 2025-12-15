'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { WorkOrder, WorkOrderType } from '@/lib/types'

interface WorkOrderWithDetails extends WorkOrder {
  application?: {
    id: string
    application_number: number
    customer_fullname: string
  }
}

const typeLabels: Record<WorkOrderType, string> = {
  survey: 'Осмотр и расчёт',
  installation: 'Монтаж',
}

export default function EditWorkOrderPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [workOrder, setWorkOrder] = useState<WorkOrderWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Форма
  const [formData, setFormData] = useState({
    type: 'survey' as WorkOrderType,
    scheduled_date: '',
    scheduled_time: '',
    estimated_duration: '',
    notes: '',
  })

  const fetchWorkOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`)
      const data = await res.json()

      if (res.ok && data.work_order) {
        const wo = data.work_order
        setWorkOrder(wo)
        setFormData({
          type: wo.type || 'survey',
          scheduled_date: wo.scheduled_date || '',
          scheduled_time: wo.scheduled_time?.slice(0, 5) || '',
          estimated_duration: wo.estimated_duration?.slice(0, 5) || '',
          notes: wo.notes || '',
        })
      } else {
        setError(data.error || 'Наряд не найден')
      }
    } catch {
      setError('Ошибка загрузки')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  const fetchCurrentUser = async () => {
    const res = await fetch('/api/auth/session')
    const data = await res.json()
    if (res.ok && data.user) {
      setCurrentUserId(data.user.id)
    }
  }

  useEffect(() => {
    fetchWorkOrder()
    fetchCurrentUser()
  }, [fetchWorkOrder])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/work-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          scheduled_time: formData.scheduled_time ? `${formData.scheduled_time}:00` : null,
          estimated_duration: formData.estimated_duration ? `${formData.estimated_duration}:00` : null,
          updated_by: currentUserId,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push(`/dashboard/work-orders/${id}`)
      } else {
        setError(data.error || 'Ошибка сохранения')
      }
    } catch {
      setError('Ошибка сети')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error && !workOrder) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
        <button onClick={() => router.back()} className="mt-4 text-indigo-600">
          ← Назад
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/dashboard/work-orders/${id}`}
          className="text-indigo-600 hover:text-indigo-800 text-sm"
        >
          ← Вернуться к наряду
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          Редактирование наряда №{workOrder?.work_order_number}
        </h1>
        {workOrder?.application && (
          <p className="text-gray-600 mt-1">
            Заявка №{workOrder.application.application_number} — {workOrder.application.customer_fullname}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Тип наряда */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Тип наряда
          </label>
          <div className="flex gap-4">
            {(['survey', 'installation'] as WorkOrderType[]).map((type) => (
              <label key={type} className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value={type}
                  checked={formData.type === type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as WorkOrderType })}
                  className="mr-2"
                />
                <span>{typeLabels[type]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Дата */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Дата выполнения
          </label>
          <input
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Время */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Время начала
          </label>
          <input
            type="time"
            value={formData.scheduled_time}
            onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Длительность */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Длительность (чч:мм)
          </label>
          <input
            type="time"
            value={formData.estimated_duration}
            onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Примечания */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Примечания
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Дополнительная информация для исполнителей..."
          />
        </div>

        {/* Кнопки */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Link
            href={`/dashboard/work-orders/${id}`}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Отмена
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}
