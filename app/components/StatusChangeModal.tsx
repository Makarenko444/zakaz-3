'use client'

import { useState, useEffect } from 'react'
import { ApplicationStatus, ApplicationStatusInfo } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth-client'

interface StatusChangeModalProps {
  applicationId: string
  currentStatus: ApplicationStatus
  onClose: () => void
  onStatusChanged: () => void
}

export default function StatusChangeModal({
  applicationId,
  currentStatus,
  onClose,
  onStatusChanged,
}: StatusChangeModalProps) {
  const [newStatus, setNewStatus] = useState<ApplicationStatus>(currentStatus)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [statuses, setStatuses] = useState<ApplicationStatusInfo[]>([])
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Загружаем статусы и текущего пользователя при монтировании
  useEffect(() => {
    loadStatuses()
    loadCurrentUser()
  }, [])

  async function loadCurrentUser() {
    try {
      const user = await getCurrentUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    } catch (error) {
      console.error('Error loading current user:', error)
    }
  }

  async function loadStatuses() {
    try {
      const response = await fetch('/api/statuses')

      if (!response.ok) {
        throw new Error('Failed to load statuses')
      }

      const data = await response.json()
      setStatuses(data.statuses)
    } catch (error) {
      console.error('Error loading statuses:', error)
      setError('Не удалось загрузить список статусов')
    } finally {
      setIsLoadingStatuses(false)
    }
  }

  // Получаем название статуса по коду
  const getStatusLabel = (code: ApplicationStatus): string => {
    const status = statuses.find(s => s.code === code)
    return status ? status.name_ru : code
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (newStatus === currentStatus) {
      setError('Выберите новый статус')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch(`/api/applications/${applicationId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_status: newStatus,
          comment: comment || null,
          changed_by: currentUserId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to change status')
      }

      onStatusChanged()
      onClose()
    } catch (error: unknown) {
      console.error('Error changing status:', error)
      setError(error instanceof Error ? error.message : 'Не удалось изменить статус')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Изменить статус</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
            disabled={isSubmitting}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Текущий статус
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700">
              {isLoadingStatuses ? 'Загрузка...' : getStatusLabel(currentStatus)}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Новый статус <span className="text-red-500">*</span>
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={isSubmitting || isLoadingStatuses}
            >
              {statuses.map((status) => (
                <option key={status.code} value={status.code}>
                  {status.name_ru}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Комментарий
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Причина изменения статуса..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting || newStatus === currentStatus}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Сохранение...
                </>
              ) : (
                'Изменить статус'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
