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

const statusColors: Record<ApplicationStatus, {
  bg: string;
  bgActive: string;
  border: string;
  borderActive: string;
  text: string;
  textActive: string;
}> = {
  new: {
    bg: 'bg-gray-100',
    bgActive: 'bg-gray-200',
    border: 'border-gray-300',
    borderActive: 'border-gray-500',
    text: 'text-gray-700',
    textActive: 'text-gray-900'
  },
  thinking: {
    bg: 'bg-blue-100',
    bgActive: 'bg-blue-200',
    border: 'border-blue-300',
    borderActive: 'border-blue-500',
    text: 'text-blue-700',
    textActive: 'text-blue-900'
  },
  estimation: {
    bg: 'bg-indigo-100',
    bgActive: 'bg-indigo-200',
    border: 'border-indigo-300',
    borderActive: 'border-indigo-500',
    text: 'text-indigo-700',
    textActive: 'text-indigo-900'
  },
  estimation_done: {
    bg: 'bg-sky-100',
    bgActive: 'bg-sky-200',
    border: 'border-sky-300',
    borderActive: 'border-sky-500',
    text: 'text-sky-700',
    textActive: 'text-sky-900'
  },
  contract: {
    bg: 'bg-cyan-100',
    bgActive: 'bg-cyan-200',
    border: 'border-cyan-300',
    borderActive: 'border-cyan-500',
    text: 'text-cyan-700',
    textActive: 'text-cyan-900'
  },
  design: {
    bg: 'bg-teal-100',
    bgActive: 'bg-teal-200',
    border: 'border-teal-300',
    borderActive: 'border-teal-500',
    text: 'text-teal-700',
    textActive: 'text-teal-900'
  },
  approval: {
    bg: 'bg-emerald-100',
    bgActive: 'bg-emerald-200',
    border: 'border-emerald-300',
    borderActive: 'border-emerald-500',
    text: 'text-emerald-700',
    textActive: 'text-emerald-900'
  },
  queue_install: {
    bg: 'bg-purple-100',
    bgActive: 'bg-purple-200',
    border: 'border-purple-300',
    borderActive: 'border-purple-500',
    text: 'text-purple-700',
    textActive: 'text-purple-900'
  },
  install: {
    bg: 'bg-violet-100',
    bgActive: 'bg-violet-200',
    border: 'border-violet-300',
    borderActive: 'border-violet-500',
    text: 'text-violet-700',
    textActive: 'text-violet-900'
  },
  installed: {
    bg: 'bg-green-100',
    bgActive: 'bg-green-200',
    border: 'border-green-300',
    borderActive: 'border-green-500',
    text: 'text-green-700',
    textActive: 'text-green-900'
  },
  rejected: {
    bg: 'bg-red-100',
    bgActive: 'bg-red-200',
    border: 'border-red-300',
    borderActive: 'border-red-500',
    text: 'text-red-700',
    textActive: 'text-red-900'
  },
  no_tech: {
    bg: 'bg-orange-100',
    bgActive: 'bg-orange-200',
    border: 'border-orange-300',
    borderActive: 'border-orange-500',
    text: 'text-orange-700',
    textActive: 'text-orange-900'
  },
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
        {/* Битрикс24 стиль - горизонтальные pill-кнопки */}
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((status, index) => {
            const isCurrent = status.code === currentStatus
            const isPassed = index < currentIndex
            const colors = statusColors[status.code]

            return (
              <button
                key={status.code}
                onClick={() => handleStatusClick(status.code)}
                disabled={disabled || isCurrent}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                  ${isCurrent
                    ? `${colors.bgActive} ${colors.textActive}`
                    : isPassed
                      ? `${colors.bg} ${colors.text} hover:${colors.bgActive}`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                  ${disabled || isCurrent ? 'cursor-default' : 'cursor-pointer'}
                `}
                title={status.description_ru || status.name_ru}
              >
                {/* Текст статуса */}
                <span className="flex items-center gap-1">
                  {isPassed && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
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
