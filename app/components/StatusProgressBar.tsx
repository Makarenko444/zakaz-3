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

const statusColors: Record<ApplicationStatus, { bg: string; border: string; text: string }> = {
  new: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-800' },
  thinking: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
  estimation: { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-800' },
  contract: { bg: 'bg-cyan-100', border: 'border-cyan-400', text: 'text-cyan-800' },
  design: { bg: 'bg-teal-100', border: 'border-teal-400', text: 'text-teal-800' },
  approval: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-800' },
  queue_install: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' },
  install: { bg: 'bg-violet-100', border: 'border-violet-400', text: 'text-violet-800' },
  installed: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
  rejected: { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-800' },
  no_tech: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' },
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Статус заявки</h3>

        {/* Progress bar */}
        <div className="relative">
          {/* Линия соединения */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0"></div>

          {/* Прогресс-линия (до текущего статуса) */}
          {currentIndex >= 0 && (
            <div
              className="absolute top-5 left-0 h-0.5 bg-indigo-500 z-0 transition-all duration-500"
              style={{ width: `${(currentIndex / (statuses.length - 1)) * 100}%` }}
            ></div>
          )}

          {/* Статусы */}
          <div className="relative z-10 grid gap-2" style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))` }}>
            {statuses.map((status, index) => {
              const isCurrent = status.code === currentStatus
              const isPassed = index < currentIndex
              const colors = statusColors[status.code]

              return (
                <div key={status.code} className="flex flex-col items-center">
                  <button
                    onClick={() => handleStatusClick(status.code)}
                    disabled={disabled || isCurrent}
                    className={`
                      w-10 h-10 rounded-full border-2 flex items-center justify-center
                      transition-all duration-200 mb-2
                      ${isCurrent
                        ? `${colors.bg} ${colors.border} ring-4 ring-opacity-30 ${colors.border.replace('border-', 'ring-')} scale-110`
                        : isPassed
                          ? 'bg-indigo-500 border-indigo-600 hover:scale-110'
                          : 'bg-white border-gray-300 hover:border-gray-400 hover:scale-105'
                      }
                      ${disabled || isCurrent ? 'cursor-default' : 'cursor-pointer'}
                    `}
                    title={status.description_ru || status.name_ru}
                  >
                    {isPassed ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className={`text-xs font-semibold ${isCurrent ? colors.text : 'text-gray-600'}`}>
                        {index + 1}
                      </span>
                    )}
                  </button>

                  <div className="text-center">
                    <p className={`text-xs font-medium leading-tight ${isCurrent ? colors.text + ' font-bold' : 'text-gray-600'}`}>
                      {status.name_ru}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
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
                  <p className={`font-semibold ${statusColors[currentStatus].text}`}>
                    {statuses.find(s => s.code === currentStatus)?.name_ru}
                  </p>
                </div>

                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>

                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Новый статус:</p>
                  <p className={`font-semibold ${statusColors[confirmingStatus].text}`}>
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
