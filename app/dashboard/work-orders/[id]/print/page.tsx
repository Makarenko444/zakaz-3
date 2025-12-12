'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { WorkOrder, WorkOrderType, WorkOrderStatus, User } from '@/lib/types'

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

export default function WorkOrderPrintPage() {
  const params = useParams()
  const id = params.id as string

  const [workOrder, setWorkOrder] = useState<WorkOrderWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchWorkOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`)
      const data = await res.json()
      if (res.ok) {
        setWorkOrder(data.work_order)
      }
    } catch {
      console.error('Error loading work order')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchWorkOrder()
  }, [fetchWorkOrder])

  useEffect(() => {
    if (!isLoading && workOrder) {
      // Автоматически открыть диалог печати
      setTimeout(() => window.print(), 500)
    }
  }, [isLoading, workOrder])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('ru-RU')
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    )
  }

  if (!workOrder) {
    return <div className="p-6 text-red-600">Наряд не найден</div>
  }

  const leadExecutor = workOrder.executors?.find(e => e.is_lead)
  const otherExecutors = workOrder.executors?.filter(e => !e.is_lead) || []

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }
        @page {
          size: A4;
          margin: 15mm;
        }
      `}</style>

      <div className="max-w-[210mm] mx-auto p-6 bg-white text-black text-sm">
        {/* Кнопка печати (скрывается при печати) */}
        <div className="no-print mb-4 flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Печать
          </button>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Закрыть
          </button>
        </div>

        {/* Шапка */}
        <div className="border-b-2 border-black pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">НАРЯД №{workOrder.work_order_number}</h1>
              <p className="text-lg mt-1">{typeLabels[workOrder.type]}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Статус: <strong>{statusLabels[workOrder.status]}</strong></p>
              <p className="text-sm text-gray-600">Дата выдачи: {formatDate(workOrder.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Информация о заявке */}
        <div className="mb-6">
          <h2 className="text-base font-bold mb-2 bg-gray-100 px-2 py-1">ЗАЯВКА №{workOrder.application?.application_number || '—'}</h2>
          <table className="w-full">
            <tbody>
              <tr>
                <td className="py-1 pr-4 text-gray-600 w-32">Клиент:</td>
                <td className="py-1 font-medium">{workOrder.application?.customer_fullname || '—'}</td>
              </tr>
              <tr>
                <td className="py-1 pr-4 text-gray-600">Телефон:</td>
                <td className="py-1 font-medium">{workOrder.application?.customer_phone || '—'}</td>
              </tr>
              <tr>
                <td className="py-1 pr-4 text-gray-600">Адрес:</td>
                <td className="py-1 font-medium">
                  {workOrder.application?.city}, {workOrder.application?.street_and_house}
                  {workOrder.application?.address_details && `, ${workOrder.application.address_details}`}
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-4 text-gray-600">Тип услуги:</td>
                <td className="py-1">{workOrder.application?.service_type || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Планирование */}
        <div className="mb-6">
          <h2 className="text-base font-bold mb-2 bg-gray-100 px-2 py-1">ПЛАНИРОВАНИЕ</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-gray-600">Дата:</span>
              <p className="font-medium">{formatDate(workOrder.scheduled_date)}</p>
            </div>
            <div>
              <span className="text-gray-600">Время:</span>
              <p className="font-medium">{workOrder.scheduled_time?.slice(0, 5) || '—'}</p>
            </div>
            <div>
              <span className="text-gray-600">Длительность:</span>
              <p className="font-medium">{workOrder.estimated_duration || '—'}</p>
            </div>
          </div>
        </div>

        {/* Исполнители */}
        <div className="mb-6">
          <h2 className="text-base font-bold mb-2 bg-gray-100 px-2 py-1">ИСПОЛНИТЕЛИ</h2>
          {workOrder.executors && workOrder.executors.length > 0 ? (
            <div>
              {leadExecutor && (
                <p className="mb-1">
                  <strong>Бригадир:</strong> {leadExecutor.user?.full_name || '—'}
                </p>
              )}
              {otherExecutors.length > 0 && (
                <p>
                  <strong>Монтажники:</strong> {otherExecutors.map(e => e.user?.full_name).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Не назначены</p>
          )}
        </div>

        {/* Материалы */}
        <div className="mb-6">
          <h2 className="text-base font-bold mb-2 bg-gray-100 px-2 py-1">МАТЕРИАЛЫ</h2>
          {workOrder.materials && workOrder.materials.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-4">№</th>
                  <th className="text-left py-1 pr-4">Наименование</th>
                  <th className="text-left py-1 pr-4">Кол-во</th>
                  <th className="text-left py-1">Ед. изм.</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.materials.map((m, idx) => (
                  <tr key={m.id} className="border-b border-gray-200">
                    <td className="py-1 pr-4">{idx + 1}</td>
                    <td className="py-1 pr-4">{m.material_name}</td>
                    <td className="py-1 pr-4">{m.quantity}</td>
                    <td className="py-1">{m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500">Материалы не указаны</p>
          )}
        </div>

        {/* Примечания */}
        {workOrder.notes && (
          <div className="mb-6">
            <h2 className="text-base font-bold mb-2 bg-gray-100 px-2 py-1">ПРИМЕЧАНИЯ</h2>
            <p>{workOrder.notes}</p>
          </div>
        )}

        {/* Блок для подписей */}
        <div className="mt-8 pt-4 border-t">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-gray-600 mb-8">Выдал:</p>
              <div className="border-b border-black w-48 mb-1"></div>
              <p className="text-xs text-gray-500">(подпись, ФИО)</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-8">Принял:</p>
              <div className="border-b border-black w-48 mb-1"></div>
              <p className="text-xs text-gray-500">(подпись, ФИО)</p>
            </div>
          </div>
        </div>

        {/* Блок результата выполнения */}
        <div className="mt-8 pt-4 border-t">
          <h2 className="text-base font-bold mb-4">РЕЗУЛЬТАТ ВЫПОЛНЕНИЯ</h2>
          <div className="border border-gray-300 p-4 min-h-[100px] mb-4">
            {workOrder.result_notes || <span className="text-gray-400">(заполняется по факту выполнения)</span>}
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-gray-600 mb-8">Дата выполнения: _______________</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-8">Подпись исполнителя:</p>
              <div className="border-b border-black w-48 mb-1"></div>
            </div>
          </div>
        </div>

        {/* Футер */}
        <div className="mt-8 pt-4 border-t text-xs text-gray-500 text-center">
          <p>Наряд сформирован: {new Date().toLocaleString('ru-RU')}</p>
          {workOrder.created_by_user && (
            <p>Создал: {workOrder.created_by_user.full_name}</p>
          )}
        </div>
      </div>
    </>
  )
}
