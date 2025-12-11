'use client'

import { useState, useEffect } from 'react'
import { ApplicationStatus } from '@/lib/types'

interface StatusFromDB {
  id: string
  code: ApplicationStatus
  name_ru: string
  description_ru: string | null
  sort_order: number
  is_active: boolean
}

interface StatusProgressBarProps {
  currentStatus: ApplicationStatus
  onStatusChange: (newStatus: ApplicationStatus) => void
  disabled?: boolean
}

export default function StatusProgressBar({ currentStatus, onStatusChange, disabled = false }: StatusProgressBarProps) {
  const [statuses, setStatuses] = useState<StatusFromDB[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmingStatus, setConfirmingStatus] = useState<ApplicationStatus | null>(null)

  useEffect(() => {
    loadStatuses()
  }, [])

  async function loadStatuses() {
    try {
      const response = await fetch('/api/statuses')
      if (!response.ok) throw new Error('Failed to load statuses')

      const data = await response.json()
      // Фильтруем только активные статусы и сортируем по sort_order
      const activeStatuses = data.statuses
        .filter((s: StatusFromDB) => s.is_active)
        .sort((a: StatusFromDB, b: StatusFromDB) => a.sort_order - b.sort_order)

      setStatuses(activeStatuses)
    } catch (error) {
      console.error('Error loading statuses:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusClick = (status: ApplicationStatus) => {
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

  // Определяем индекс текущего статуса
  const currentIndex = statuses.findIndex(s => s.code === currentStatus)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        {/* Упрощённый стиль - горизонтальные pill-кнопки */}
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((status, index) => {
            const isCurrent = status.code === currentStatus
            const isPassed = index < currentIndex
            const isFuture = index > currentIndex

            // Универсальные стили для темной и светлой темы
            let buttonClasses = 'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border-2 '

            if (isCurrent) {
              // Текущий статус: галочка + яркая рамка
              buttonClasses += 'bg-blue-50 text-blue-700 border-blue-500 ring-2 ring-blue-200 '
            } else if (isPassed) {
              // Пройденные статусы: галочка, приглушённый зелёный
              buttonClasses += 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100 '
            } else {
              // Будущие статусы: серые
              buttonClasses += 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-600 '
            }

            if (disabled || isCurrent) {
              buttonClasses += 'cursor-default '
            } else {
              buttonClasses += 'cursor-pointer '
            }

            return (
              <button
                key={status.code}
                onClick={() => handleStatusClick(status.code)}
                disabled={disabled || isCurrent}
                className={buttonClasses}
                title={status.description_ru || status.name_ru}
              >
                <span className="flex items-center gap-1">
                  {/* Галочка для пройденных и текущего статуса */}
                  {(isPassed || isCurrent) && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {/* Кружок для будущих статусов */}
                  {isFuture && (
                    <span className="w-2 h-2 rounded-full bg-gray-300 mr-0.5"></span>
                  )}
                  {status.name_ru}
                </span>
              </button>
            )
          })}
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
                Вы уверены, что хотите изменить статус заявки?
              </p>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Текущий статус:</p>
                  <p className="font-semibold text-gray-900">
                    {statuses.find(s => s.code === currentStatus)?.name_ru}
                  </p>
                </div>

                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>

                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Новый статус:</p>
                  <p className="font-semibold text-gray-900">
                    {statuses.find(s => s.code === confirmingStatus)?.name_ru}
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
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium transition"
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
