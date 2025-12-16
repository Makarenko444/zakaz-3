'use client'

import { useState } from 'react'
import { WorkOrderStatus } from '@/lib/types'

interface WorkOrderStatusBarProps {
  currentStatus: WorkOrderStatus
  onStatusChange: (newStatus: WorkOrderStatus) => void
  disabled?: boolean
}

const statuses: Array<{
  code: WorkOrderStatus
  name: string
  description: string
}> = [
  { code: 'draft', name: 'Черновик', description: 'Наряд создан, но ещё не выдан' },
  { code: 'assigned', name: 'Выдан', description: 'Наряд выдан исполнителям' },
  { code: 'in_progress', name: 'В работе', description: 'Исполнители приступили к работе' },
  { code: 'completed', name: 'Выполнен', description: 'Работы завершены' },
]

const cancelledStatus = { code: 'cancelled' as WorkOrderStatus, name: 'Отменён', description: 'Наряд отменён' }

export default function WorkOrderStatusBar({ currentStatus, onStatusChange, disabled = false }: WorkOrderStatusBarProps) {
  const [confirmingStatus, setConfirmingStatus] = useState<WorkOrderStatus | null>(null)

  const handleStatusClick = (status: WorkOrderStatus) => {
    if (disabled || status === currentStatus) return
    setConfirmingStatus(status)
  }

  const handleConfirm = () => {
    if (confirmingStatus) {
      onStatusChange(confirmingStatus)
      setConfirmingStatus(null)
    }
  }

  const handleCancel = () => {
    setConfirmingStatus(null)
  }

  // Определяем индекс текущего статуса (cancelled обрабатывается отдельно)
  const currentIndex = currentStatus === 'cancelled' ? -1 : statuses.findIndex(s => s.code === currentStatus)
  const isCancelled = currentStatus === 'cancelled'

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((status, index) => {
            const isCurrent = status.code === currentStatus
            const isPassed = currentIndex >= 0 && index < currentIndex
            const isFuture = currentIndex >= 0 && index > currentIndex

            let buttonClasses = 'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border-2 '

            if (isCancelled) {
              // Если наряд отменён, все статусы показываем серыми
              buttonClasses += 'bg-gray-100 text-gray-400 border-gray-200 '
            } else if (isCurrent) {
              // Текущий статус
              buttonClasses += 'bg-blue-50 text-blue-700 border-blue-500 ring-2 ring-blue-200 '
            } else if (isPassed) {
              // Пройденные статусы
              buttonClasses += 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100 '
            } else {
              // Будущие статусы
              buttonClasses += 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-600 '
            }

            if (disabled || isCurrent || isCancelled) {
              buttonClasses += 'cursor-default '
            } else {
              buttonClasses += 'cursor-pointer '
            }

            return (
              <button
                key={status.code}
                onClick={() => handleStatusClick(status.code)}
                disabled={disabled || isCurrent || isCancelled}
                className={buttonClasses}
                title={status.description}
              >
                <span className="flex items-center gap-1">
                  {(isPassed || isCurrent) && !isCancelled && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {(isFuture || isCancelled) && (
                    <span className="w-2 h-2 rounded-full bg-gray-300 mr-0.5"></span>
                  )}
                  {status.name}
                </span>
              </button>
            )
          })}

          {/* Кнопка отмены - отдельно */}
          <button
            onClick={() => handleStatusClick('cancelled')}
            disabled={disabled || isCancelled}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border-2 ${
              isCancelled
                ? 'bg-red-50 text-red-700 border-red-500 ring-2 ring-red-200 cursor-default'
                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300 cursor-pointer'
            }`}
            title={cancelledStatus.description}
          >
            <span className="flex items-center gap-1">
              {isCancelled && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {cancelledStatus.name}
            </span>
          </button>
        </div>
      </div>

      {/* Модальное окно подтверждения */}
      {confirmingStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Подтвердите изменение статуса
            </h3>

            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Вы уверены, что хотите изменить статус наряда?
              </p>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Текущий статус:</p>
                  <p className="font-semibold text-gray-900">
                    {currentStatus === 'cancelled' ? cancelledStatus.name : statuses.find(s => s.code === currentStatus)?.name}
                  </p>
                </div>

                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>

                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Новый статус:</p>
                  <p className={`font-semibold ${confirmingStatus === 'cancelled' ? 'text-red-600' : 'text-gray-900'}`}>
                    {confirmingStatus === 'cancelled' ? cancelledStatus.name : statuses.find(s => s.code === confirmingStatus)?.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
                  confirmingStatus === 'cancelled'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
