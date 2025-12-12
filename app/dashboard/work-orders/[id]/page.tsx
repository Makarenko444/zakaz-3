'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { WorkOrder, WorkOrderType, WorkOrderStatus, User, Material } from '@/lib/types'

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

  // Модальные окна
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showExecutorModal, setShowExecutorModal] = useState(false)
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<WorkOrderStatus>('draft')
  const [statusComment, setStatusComment] = useState('')

  const fetchWorkOrder = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/work-orders/${id}`)
      const data = await res.json()

      if (res.ok) {
        setWorkOrder(data.work_order)
        setSelectedStatus(data.work_order.status)
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

  useEffect(() => {
    fetchWorkOrder()
    fetchUsers()
    fetchMaterials()
    fetchCurrentUser()
  }, [fetchWorkOrder])

  const handleStatusChange = async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedStatus,
          comment: statusComment,
        }),
      })

      if (res.ok) {
        setShowStatusModal(false)
        setStatusComment('')
        fetchWorkOrder()
      }
    } catch {
      console.error('Error changing status')
    }
  }

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Шапка */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Наряд №{workOrder.work_order_number}
            </h1>
            <span className={`px-3 py-1 text-sm font-medium rounded-full border ${statusColors[workOrder.status]}`}>
              {statusLabels[workOrder.status]}
            </span>
          </div>
          <p className="text-gray-600">{typeLabels[workOrder.type]}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStatusModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Сменить статус
          </button>
          {currentUser?.role === 'admin' && (
            <button
              onClick={handleDeleteWorkOrder}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? 'Удаление...' : 'Удалить'}
            </button>
          )}
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Назад
          </button>
        </div>
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
              <span className="ml-2">{workOrder.estimated_duration || '—'}</span>
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
              {workOrder.executors.map((ex) => (
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
                        className="text-xs text-gray-500 hover:text-indigo-600"
                        title="Назначить бригадиром"
                      >
                        ★
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveExecutor(ex.id)}
                      className="text-xs text-red-500 hover:text-red-700"
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
            <button
              onClick={() => setShowMaterialModal(true)}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              + Добавить
            </button>
          </div>
          {workOrder.materials && workOrder.materials.length > 0 ? (
            <div className="space-y-2">
              {workOrder.materials.map((m) => (
                <div key={m.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <div className="text-sm">{m.material_name}</div>
                    <div className="text-xs text-gray-500">{m.quantity} {m.unit}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveMaterial(m.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
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

      {/* Мета-информация */}
      <div className="mt-6 text-sm text-gray-500">
        <p>Создан: {formatDateTime(workOrder.created_at)} {workOrder.created_by_user?.full_name && `(${workOrder.created_by_user.full_name})`}</p>
        <p>Изменён: {formatDateTime(workOrder.updated_at)} {workOrder.updated_by_user?.full_name && `(${workOrder.updated_by_user.full_name})`}</p>
      </div>

      {/* Модалка смены статуса */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Смена статуса</h3>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as WorkOrderStatus)}
              className="w-full px-3 py-2 border rounded-lg mb-4"
            >
              <option value="draft">Черновик</option>
              <option value="assigned">Выдан</option>
              <option value="in_progress">В работе</option>
              <option value="completed">Выполнен</option>
              <option value="cancelled">Отменён</option>
            </select>
            <textarea
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              placeholder="Комментарий (необязательно)"
              className="w-full px-3 py-2 border rounded-lg mb-4 h-24"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleStatusChange}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}

// Компонент модалки материала
function MaterialModal({
  materials,
  onAdd,
  onClose,
}: {
  materials: Material[]
  onAdd: (materialId: string | null, name: string, unit: string, quantity: number) => void
  onClose: () => void
}) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [customName, setCustomName] = useState('')
  const [customUnit, setCustomUnit] = useState('шт')
  const [quantity, setQuantity] = useState(1)
  const [useCustom, setUseCustom] = useState(false)

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId)

  const handleSubmit = () => {
    if (useCustom) {
      if (!customName) return
      onAdd(null, customName, customUnit, quantity)
    } else {
      if (!selectedMaterial) return
      onAdd(selectedMaterial.id, selectedMaterial.name, selectedMaterial.unit, quantity)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Добавить материал</h3>

        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
            />
            <span className="text-sm">Свободный ввод</span>
          </label>
        </div>

        {!useCustom ? (
          <select
            value={selectedMaterialId}
            onChange={(e) => setSelectedMaterialId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg mb-4"
          >
            <option value="">Выберите материал</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.unit})
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-3 mb-4">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Название материала"
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              type="text"
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              placeholder="Единица измерения"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm text-gray-700 mb-1">Количество</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            min={0}
            step={0.1}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
            disabled={!useCustom && !selectedMaterialId}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}
