'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { WorkOrder, WorkOrderType, WorkOrderStatus, User, Material, MaterialTemplate } from '@/lib/types'
import WorkOrderStatusBar from '@/app/components/WorkOrderStatusBar'

interface WorkOrderWithDetails extends WorkOrder {
  application?: {
    id: string
    application_number: number
    customer_fullname: string
    customer_phone: string
    customer_type: string
    city: string
    street_and_house: string | null
    address_details: string | null
    service_type: string
    urgency: string
    status: string
  }
  executors?: Array<{
    id: string
    user_id: string
    is_lead: boolean
    created_at: string
    user?: User
  }>
  materials?: Array<{
    id: string
    material_id: string | null
    material_name: string
    unit: string
    quantity: number
    notes: string | null
    created_at: string
  }>
  created_by_user?: { id: string; full_name: string; email: string }
  updated_by_user?: { id: string; full_name: string; email: string }
}

const typeLabels: Record<WorkOrderType, string> = {
  survey: 'Осмотр и расчёт',
  installation: 'Монтаж',
}

const statusLabels: Record<WorkOrderStatus, string> = {
  draft: 'Черновик',
  assigned: 'Выдан',
  in_progress: 'В работе',
  completed: 'Выполнен',
  cancelled: 'Отменён',
}

const statusColors: Record<WorkOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 border-gray-300',
  assigned: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
}

export default function WorkOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [workOrder, setWorkOrder] = useState<WorkOrderWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Шаблоны материалов
  const [templates, setTemplates] = useState<MaterialTemplate[]>([])

  // Модальные окна
  const [showExecutorModal, setShowExecutorModal] = useState(false)
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [showPrefillModal, setShowPrefillModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)

  // Отчёт об исполнении
  const [resultNotes, setResultNotes] = useState('')
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const [isCompleting, setIsCompleting] = useState(false)
  const [workOrderFiles, setWorkOrderFiles] = useState<Array<{
    id: string
    original_filename: string
    file_size: number
    mime_type: string
    uploaded_at: string
    description: string | null
    uploaded_by_user?: { full_name: string }
  }>>([])
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  const fetchWorkOrder = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/work-orders/${id}`)
      const data = await res.json()

      if (res.ok) {
        setWorkOrder(data.work_order)
      } else {
        setError(data.error || 'Ошибка загрузки')
      }
    } catch (_err) {
      setError('Ошибка сети')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  const fetchUsers = async () => {
    const res = await fetch('/api/users?active=true')
    const data = await res.json()
    if (res.ok) setUsers(data.users || [])
  }

  const fetchMaterials = async () => {
    const res = await fetch('/api/materials')
    const data = await res.json()
    if (res.ok) setMaterials(data.materials || [])
  }

  const fetchCurrentUser = async () => {
    const res = await fetch('/api/auth/session')
    const data = await res.json()
    if (res.ok && data.user) setCurrentUser(data.user)
  }

  const fetchTemplates = async () => {
    const res = await fetch('/api/material-templates')
    const data = await res.json()
    if (res.ok) setTemplates(data.templates || [])
  }

  const fetchWorkOrderFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}/files`)
      const data = await res.json()
      if (res.ok) setWorkOrderFiles(data.files || [])
    } catch {
      console.error('Error fetching work order files')
    }
  }, [id])

  useEffect(() => {
    fetchWorkOrder()
    fetchUsers()
    fetchMaterials()
    fetchCurrentUser()
    fetchTemplates()
    fetchWorkOrderFiles()
  }, [fetchWorkOrder, fetchWorkOrderFiles])

  const handleAddExecutor = async (userId: string, isLead: boolean) => {
    try {
      const res = await fetch(`/api/work-orders/${id}/executors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, is_lead: isLead }),
      })

      if (res.ok) {
        setShowExecutorModal(false)
        fetchWorkOrder()
      }
    } catch {
      console.error('Error adding executor')
    }
  }

  const handleRemoveExecutor = async (executorId: string) => {
    // Проверяем, что это не последний исполнитель
    if (workOrder?.executors && workOrder.executors.length <= 1) {
      alert('Нельзя удалить последнего исполнителя. В наряде должен быть минимум один исполнитель.')
      return
    }

    if (!confirm('Удалить исполнителя?')) return

    try {
      const res = await fetch(`/api/work-orders/${id}/executors?executor_id=${executorId}`, {
        method: 'DELETE',
      })

      if (res.ok) fetchWorkOrder()
    } catch {
      console.error('Error removing executor')
    }
  }

  const handleSetLead = async (executorId: string) => {
    try {
      const res = await fetch(`/api/work-orders/${id}/executors`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executor_id: executorId, is_lead: true }),
      })

      if (res.ok) fetchWorkOrder()
    } catch {
      console.error('Error setting lead')
    }
  }

  const handleAddMaterial = async (materialId: string | null, name: string, unit: string, quantity: number) => {
    try {
      const res = await fetch(`/api/work-orders/${id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: materialId,
          material_name: name,
          unit,
          quantity,
        }),
      })

      if (res.ok) {
        setShowMaterialModal(false)
        fetchWorkOrder()
      }
    } catch {
      console.error('Error adding material')
    }
  }

  const handleRemoveMaterial = async (materialRecordId: string) => {
    try {
      const res = await fetch(`/api/work-orders/${id}/materials?material_record_id=${materialRecordId}`, {
        method: 'DELETE',
      })

      if (res.ok) fetchWorkOrder()
    } catch {
      console.error('Error removing material')
    }
  }

  const handleUpdateMaterialQty = async (materialRecordId: string, quantity: number) => {
    try {
      const res = await fetch(`/api/work-orders/${id}/materials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_record_id: materialRecordId, quantity }),
      })

      if (res.ok) fetchWorkOrder()
    } catch {
      console.error('Error updating material quantity')
    }
  }

  const handleApplyTemplate = async (templateId: string) => {
    try {
      // Получаем шаблон с позициями
      const res = await fetch(`/api/material-templates/${templateId}`)
      const data = await res.json()

      if (!res.ok || !data.template?.items) return

      // Получаем список уже добавленных материалов
      const existingMaterials = workOrder?.materials || []
      const existingMaterialIds = new Set(existingMaterials.map(m => m.material_id).filter(Boolean))
      const existingMaterialNames = new Set(existingMaterials.map(m => m.material_name.toLowerCase()))

      // Добавляем только те позиции, которых ещё нет
      for (const item of data.template.items) {
        // Проверяем по material_id (если есть) или по названию
        const isDuplicate = item.material_id
          ? existingMaterialIds.has(item.material_id)
          : existingMaterialNames.has(item.material_name.toLowerCase())

        if (isDuplicate) continue

        await fetch(`/api/work-orders/${id}/materials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            material_id: item.material_id,
            material_name: item.material_name,
            unit: item.unit,
            quantity: item.quantity,
          }),
        })
      }

      setShowPrefillModal(false)
      fetchWorkOrder()
    } catch {
      console.error('Error applying template')
    }
  }

  const handleDeleteWorkOrder = async () => {
    if (!confirm(`Удалить наряд №${workOrder?.work_order_number}? Это действие необратимо.`)) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/work-orders/${id}?user_id=${currentUser?.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        // Вернуться к заявке или списку нарядов
        if (workOrder?.application?.id) {
          router.push(`/dashboard/applications/${workOrder.application.id}`)
        } else {
          router.push('/dashboard/applications')
        }
      } else {
        const data = await res.json()
        alert(data.error || 'Ошибка удаления наряда')
      }
    } catch {
      alert('Ошибка сети')
    } finally {
      setIsDeleting(false)
    }
  }

  // Отчёт об исполнении
  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      // Сначала загружаем файлы
      for (const file of completionFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('description', 'Отчёт об исполнении')

        await fetch(`/api/work-orders/${id}/files`, {
          method: 'POST',
          body: formData,
        })
      }

      // Затем отмечаем наряд как выполненный
      const res = await fetch(`/api/work-orders/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result_notes: resultNotes,
        }),
      })

      if (res.ok) {
        setShowCompleteModal(false)
        setResultNotes('')
        setCompletionFiles([])
        fetchWorkOrder()
        fetchWorkOrderFiles()
      } else {
        const data = await res.json()
        alert(data.error || 'Ошибка при завершении наряда')
      }
    } catch {
      alert('Ошибка сети')
    } finally {
      setIsCompleting(false)
    }
  }

  // Загрузка одного файла к наряду
  const handleUploadFile = async (file: File, description?: string) => {
    setIsUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (description) formData.append('description', description)

      const res = await fetch(`/api/work-orders/${id}/files`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        fetchWorkOrderFiles()
      } else {
        const data = await res.json()
        alert(data.error || 'Ошибка загрузки файла')
      }
    } catch {
      alert('Ошибка сети')
    } finally {
      setIsUploadingFile(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('ru-RU')
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('ru-RU')
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error || !workOrder) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error || 'Наряд не найден'}
        </div>
        <button onClick={() => router.back()} className="mt-4 text-indigo-600">
          ← Назад
        </button>
      </div>
    )
  }

  const assignedUserIds = workOrder.executors?.map(e => e.user_id) || []
  const availableUsers = users.filter(u => !assignedUserIds.includes(u.id))

  // Проверка прав: админ, автор или исполнитель
  const isExecutor = currentUser && assignedUserIds.includes(currentUser.id)
  const canEdit = currentUser?.role === 'admin' || currentUser?.id === workOrder.created_by || isExecutor
  const canDelete = currentUser?.role === 'admin' || currentUser?.id === workOrder.created_by

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Шапка */}
      <div className="mb-6">
        {/* Верхняя строка: заголовок и основные кнопки */}
        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Наряд №{workOrder.work_order_number}
              </h1>
              <span className={`px-3 py-1 text-sm font-medium rounded-full border ${statusColors[workOrder.status]}`}>
                {statusLabels[workOrder.status]}
              </span>
            </div>
            <p className="text-gray-600 ml-9">{typeLabels[workOrder.type]}</p>
          </div>

          {/* Кнопки действий */}
          <div className="flex flex-wrap gap-2">
            {/* Печать - серая иконка-кнопка */}
            <button
              onClick={() => window.open(`/print/work-orders/${id}`, '_blank')}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              title="Печать"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>

            {/* Редактировать - outline с иконкой */}
            {canEdit && (
              <Link
                href={`/dashboard/work-orders/${id}/edit`}
                className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Редактировать
              </Link>
            )}

            {/* Выполнено - зелёная кнопка */}
            {workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && canEdit && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Выполнено
              </button>
            )}

            {/* Удалить - красный outline с иконкой */}
            {canDelete && (
              <button
                onClick={handleDeleteWorkOrder}
                disabled={isDeleting}
                className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2 text-sm font-medium transition disabled:opacity-50"
                title="Удалить наряд"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {isDeleting ? '...' : 'Удалить'}
              </button>
            )}
          </div>
        </div>

        {/* Статус-бар */}
        <WorkOrderStatusBar
          currentStatus={workOrder.status}
          onStatusChange={async (newStatus) => {
            try {
              const res = await fetch(`/api/work-orders/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
              })
              if (res.ok) fetchWorkOrder()
            } catch {
              console.error('Error changing status')
            }
          }}
          disabled={!canEdit}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Информация о заявке */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold mb-4">Заявка</h2>
          {workOrder.application ? (
            <div className="space-y-3">
              <div>
                <span className="text-gray-500 text-sm">Номер:</span>
                <Link
                  href={`/dashboard/applications/${workOrder.application.id}`}
                  className="ml-2 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  №{workOrder.application.application_number}
                </Link>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Клиент:</span>
                <span className="ml-2">{workOrder.application.customer_fullname}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Телефон:</span>
                <a href={`tel:${workOrder.application.customer_phone}`} className="ml-2 text-indigo-600">
                  {workOrder.application.customer_phone}
                </a>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Адрес:</span>
                <span className="ml-2">
                  {workOrder.application.city}, {workOrder.application.street_and_house}
                  {workOrder.application.address_details && `, ${workOrder.application.address_details}`}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Заявка не найдена</p>
          )}
        </div>

        {/* Планирование */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold mb-4">Планирование</h2>
          <div className="space-y-3">
            <div>
              <span className="text-gray-500 text-sm">Дата:</span>
              <span className="ml-2">{formatDate(workOrder.scheduled_date)}</span>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Время:</span>
              <span className="ml-2">{workOrder.scheduled_time?.slice(0, 5) || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Длительность:</span>
              <span className="ml-2">{workOrder.estimated_duration?.slice(0, 5) || '—'}</span>
            </div>
            {workOrder.actual_start_at && (
              <div>
                <span className="text-gray-500 text-sm">Факт. начало:</span>
                <span className="ml-2">{formatDateTime(workOrder.actual_start_at)}</span>
              </div>
            )}
            {workOrder.actual_end_at && (
              <div>
                <span className="text-gray-500 text-sm">Факт. окончание:</span>
                <span className="ml-2">{formatDateTime(workOrder.actual_end_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Исполнители */}
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Исполнители</h2>
            <button
              onClick={() => setShowExecutorModal(true)}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              + Добавить
            </button>
          </div>
          {workOrder.executors && workOrder.executors.length > 0 ? (
            <div className="space-y-2">
              {[...workOrder.executors].sort((a, b) => (b.is_lead ? 1 : 0) - (a.is_lead ? 1 : 0)).map((ex) => (
                <div key={ex.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${ex.is_lead ? 'bg-yellow-400' : 'bg-gray-300'}`}></span>
                    <span>{ex.user?.full_name || '?'}</span>
                    {ex.is_lead && <span className="text-xs text-yellow-600">(бригадир)</span>}
                  </div>
                  <div className="flex gap-2">
                    {!ex.is_lead && (
                      <button
                        onClick={() => handleSetLead(ex.id)}
                        className="text-lg text-gray-400 hover:text-yellow-500 transition-colors"
                        title="Назначить бригадиром"
                      >
                        ★
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveExecutor(ex.id)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Исполнители не назначены</p>
          )}
        </div>

        {/* Материалы */}
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Материалы</h2>
            <div className="flex gap-3">
              {templates.length > 0 && (
                <button
                  onClick={() => setShowPrefillModal(true)}
                  className="text-sm text-green-600 hover:text-green-800"
                >
                  Предзаполнить
                </button>
              )}
              <button
                onClick={() => setShowMaterialModal(true)}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                + Добавить
              </button>
            </div>
          </div>
          {workOrder.materials && workOrder.materials.length > 0 ? (
            <div className="space-y-2">
              {workOrder.materials.map((m) => (
                <div key={m.id} className="flex justify-between items-center py-2 border-b last:border-0 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{m.material_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateMaterialQty(m.id, Math.max(0, m.quantity - 1))}
                      className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-100 text-gray-600"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={m.quantity}
                      onChange={(e) => handleUpdateMaterialQty(m.id, Math.max(0, Number(e.target.value)))}
                      min={0}
                      step={0.1}
                      className="w-16 px-2 py-1 border rounded text-center text-sm"
                    />
                    <button
                      onClick={() => handleUpdateMaterialQty(m.id, m.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-100 text-gray-600"
                    >
                      +
                    </button>
                    <span className="text-xs text-gray-500 w-8">{m.unit}</span>
                    <button
                      onClick={() => handleRemoveMaterial(m.id)}
                      className="text-red-400 hover:text-red-600 ml-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Материалы не указаны</p>
          )}
        </div>
      </div>

      {/* Примечания */}
      {(workOrder.notes || workOrder.result_notes) && (
        <div className="mt-6 bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold mb-4">Примечания</h2>
          {workOrder.notes && (
            <div className="mb-3">
              <span className="text-gray-500 text-sm">При выдаче:</span>
              <p className="mt-1">{workOrder.notes}</p>
            </div>
          )}
          {workOrder.result_notes && (
            <div>
              <span className="text-gray-500 text-sm">Результат:</span>
              <p className="mt-1">{workOrder.result_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Файлы наряда */}
      <div className="mt-6 bg-white rounded-lg shadow p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Файлы</h2>
          <label className="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer">
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUploadFile(file)
                e.target.value = ''
              }}
              disabled={isUploadingFile}
            />
            {isUploadingFile ? 'Загрузка...' : '+ Добавить файл'}
          </label>
        </div>
        {workOrderFiles.length > 0 ? (
          <div className="space-y-2">
            {workOrderFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                    {file.mime_type.startsWith('image/') ? '🖼️' :
                     file.mime_type === 'application/pdf' ? '📄' : '📎'}
                  </div>
                  <div>
                    <a
                      href={`/api/applications/${workOrder.application_id}/files/${file.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      {file.original_filename}
                    </a>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(file.file_size)}
                      {file.description && ` • ${file.description}`}
                      {file.uploaded_by_user && ` • ${file.uploaded_by_user.full_name}`}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(file.uploaded_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Файлы не прикреплены</p>
        )}
      </div>

      {/* Мета-информация */}
      <div className="mt-6 text-sm text-gray-500">
        <p>Создан: {formatDateTime(workOrder.created_at)} {workOrder.created_by_user?.full_name && `(${workOrder.created_by_user.full_name})`}</p>
        <p>Изменён: {formatDateTime(workOrder.updated_at)} {workOrder.updated_by_user?.full_name && `(${workOrder.updated_by_user.full_name})`}</p>
      </div>

      {/* Модалка добавления исполнителя */}
      {showExecutorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Добавить исполнителя</h3>
            {availableUsers.length === 0 ? (
              <p className="text-gray-500 mb-4">Нет доступных пользователей</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
                {availableUsers.map((user) => (
                  <div key={user.id} className="flex justify-between items-center py-2 border-b">
                    <span>{user.full_name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddExecutor(user.id, false)}
                        className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                      >
                        Добавить
                      </button>
                      <button
                        onClick={() => handleAddExecutor(user.id, true)}
                        className="px-2 py-1 text-xs bg-yellow-100 rounded hover:bg-yellow-200"
                      >
                        Бригадир
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowExecutorModal(false)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Модалка добавления материала */}
      {showMaterialModal && (
        <MaterialModal
          materials={materials}
          onAdd={handleAddMaterial}
          onClose={() => setShowMaterialModal(false)}
        />
      )}

      {/* Модалка выбора шаблона для предзаполнения */}
      {showPrefillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Выберите шаблон материалов</h3>
            {templates.length === 0 ? (
              <p className="text-gray-500 mb-4">Нет доступных шаблонов</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleApplyTemplate(template.id)}
                    className="w-full text-left px-4 py-3 border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                  >
                    <div className="font-medium">{template.name}</div>
                    {template.description && (
                      <div className="text-sm text-gray-500 mt-1">{template.description}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowPrefillModal(false)}
              className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Модалка отчёта об исполнении */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">Отчёт об исполнении</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Комментарий о выполнении
              </label>
              <textarea
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
                placeholder="Опишите результат работы..."
                className="w-full px-3 py-2 border rounded-lg h-32"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Прикрепить файлы (фото, расчёты)
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  setCompletionFiles(prev => [...prev, ...files])
                  e.target.value = ''
                }}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {completionFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {completionFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 px-2 py-1 rounded">
                      <span className="truncate">{file.name}</span>
                      <button
                        onClick={() => setCompletionFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCompleteModal(false)
                  setResultNotes('')
                  setCompletionFiles([])
                }}
                className="px-4 py-2 border rounded-lg"
                disabled={isCompleting}
              >
                Отмена
              </button>
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isCompleting ? 'Сохранение...' : 'Завершить наряд'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Элемент корзины материалов
interface CartItem {
  materialId: string | null
  name: string
  unit: string
  quantity: number
  price: number
  stock: number
}

// Компонент модалки материала - улучшенная версия
function MaterialModal({
  materials,
  onAdd,
  onClose,
}: {
  materials: Material[]
  onAdd: (materialId: string | null, name: string, unit: string, quantity: number) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customUnit, setCustomUnit] = useState('шт')
  const [customQty, setCustomQty] = useState(1)
  const [isSaving, setIsSaving] = useState(false)

  // Фильтрация материалов по поиску
  const filteredMaterials = materials.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.code?.toLowerCase().includes(q)
  })

  // Добавить материал в корзину
  const addToCart = (material: Material) => {
    setCart(prev => {
      const existing = prev.find(item => item.materialId === material.id)
      if (existing) {
        return prev.map(item =>
          item.materialId === material.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, {
        materialId: material.id,
        name: material.name,
        unit: material.unit,
        quantity: 1,
        price: material.price || 0,
        stock: material.stock_quantity || 0,
      }]
    })
  }

  // Изменить количество в корзине
  const updateCartQty = (materialId: string | null, quantity: number) => {
    if (quantity < 0) {
      setCart(prev => prev.filter(item => item.materialId !== materialId))
    } else {
      setCart(prev => prev.map(item =>
        item.materialId === materialId ? { ...item, quantity } : item
      ))
    }
  }

  // Удалить из корзины
  const removeFromCart = (materialId: string | null) => {
    setCart(prev => prev.filter(item => item.materialId !== materialId))
  }

  // Добавить свободный материал
  const addCustomToCart = () => {
    if (!customName.trim()) return
    setCart(prev => [...prev, {
      materialId: null,
      name: customName.trim(),
      unit: customUnit || 'шт',
      quantity: customQty,
      price: 0,
      stock: 0,
    }])
    setCustomName('')
    setCustomUnit('шт')
    setCustomQty(1)
    setShowCustomForm(false)
  }

  // Сохранить все материалы
  const handleSave = async () => {
    if (cart.length === 0) return
    setIsSaving(true)
    try {
      for (const item of cart) {
        await new Promise<void>(resolve => {
          onAdd(item.materialId, item.name, item.unit, item.quantity)
          // Небольшая задержка между запросами
          setTimeout(resolve, 100)
        })
      }
      onClose()
    } catch {
      console.error('Error saving materials')
    } finally {
      setIsSaving(false)
    }
  }

  const formatPrice = (price: number) => {
    return price.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
  }

  const activityColors: Record<number, string> = {
    1: 'bg-green-100 text-green-800',
    2: 'bg-blue-100 text-blue-800',
    3: 'bg-yellow-100 text-yellow-800',
    4: 'bg-gray-100 text-gray-500',
  }

  // Суммарная стоимость корзины
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Заголовок */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h3 className="text-xl font-semibold">Добавить материалы</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Левая панель - каталог */}
          <div className="flex-1 flex flex-col border-r overflow-hidden">
            {/* Поиск */}
            <div className="p-4 border-b">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по названию или коду..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Найдено: {filteredMaterials.length} из {materials.length}
              </div>
            </div>

            {/* Список материалов */}
            <div className="flex-1 overflow-y-auto">
              {filteredMaterials.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Материалы не найдены
                </div>
              ) : (
                <div className="divide-y">
                  {filteredMaterials.slice(0, 100).map((material) => {
                    const inCart = cart.find(c => c.materialId === material.id)
                    return (
                      <div
                        key={material.id}
                        className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${inCart ? 'bg-indigo-50' : ''}`}
                        onClick={() => addToCart(material)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${activityColors[material.activity_level] || activityColors[4]}`}>
                                {material.activity_level}
                              </span>
                              {material.code && (
                                <span className="text-xs text-gray-400 font-mono">{material.code}</span>
                              )}
                            </div>
                            <div className="font-medium text-gray-900 truncate mt-1">
                              {material.name}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm">
                              <span className="text-gray-500">{material.unit}</span>
                              {(material.price || 0) > 0 && (
                                <span className="text-green-600">{formatPrice(material.price)}</span>
                              )}
                              {(material.stock_quantity || 0) > 0 && (
                                <span className="text-blue-600">остаток: {material.stock_quantity}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {inCart ? (
                              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm font-medium">
                                ✓ {inCart.quantity}
                              </span>
                            ) : (
                              <button className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm">
                                +
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {filteredMaterials.length > 100 && (
                    <div className="p-3 text-center text-gray-500 text-sm">
                      Показаны первые 100 результатов. Уточните поиск.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Свободный ввод */}
            <div className="p-3 border-t bg-gray-50">
              {showCustomForm ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Название материала"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      placeholder="Ед."
                      className="w-20 px-3 py-2 border rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={customQty}
                      onChange={(e) => setCustomQty(Number(e.target.value))}
                      min={0}
                      step={0.1}
                      className="w-20 px-3 py-2 border rounded-lg text-sm"
                    />
                    <button
                      onClick={addCustomToCart}
                      disabled={!customName.trim()}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      Добавить
                    </button>
                    <button
                      onClick={() => setShowCustomForm(false)}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomForm(true)}
                  className="text-sm text-gray-600 hover:text-indigo-600"
                >
                  + Свободный ввод (материал не из справочника)
                </button>
              )}
            </div>
          </div>

          {/* Правая панель - корзина */}
          <div className="w-80 flex flex-col bg-gray-50">
            <div className="p-4 border-b bg-white">
              <h4 className="font-semibold text-gray-900">
                Выбрано: {cart.length} поз.
              </h4>
              {totalPrice > 0 && (
                <div className="text-sm text-gray-500 mt-1">
                  Сумма: {formatPrice(totalPrice)}
                </div>
              )}
            </div>

            {/* Список корзины */}
            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">
                  Нажмите на материал слева, чтобы добавить
                </div>
              ) : (
                <div className="divide-y">
                  {cart.map((item, idx) => (
                    <div key={item.materialId || `custom-${idx}`} className="p-3 bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {item.name}
                          </div>
                          {item.price > 0 && (
                            <div className="text-xs text-gray-500">
                              {formatPrice(item.price)} × {item.quantity} = {formatPrice(item.price * item.quantity)}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.materialId)}
                          className="text-red-400 hover:text-red-600 ml-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQty(item.materialId, Math.max(0, item.quantity - 1))}
                          className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-100"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateCartQty(item.materialId, Math.max(0, Number(e.target.value)))}
                          min={0}
                          step={0.1}
                          className="w-16 px-2 py-1 border rounded text-center text-sm"
                        />
                        <button
                          onClick={() => updateCartQty(item.materialId, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center border rounded hover:bg-gray-100"
                        >
                          +
                        </button>
                        <span className="text-sm text-gray-500">{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Кнопка сохранения */}
            <div className="p-4 border-t bg-white">
              <button
                onClick={handleSave}
                disabled={cart.length === 0 || isSaving}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Сохранение...' : `Добавить ${cart.length} поз.`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
