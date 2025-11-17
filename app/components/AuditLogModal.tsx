'use client'

import { useEffect, useState, useCallback } from 'react'

interface AuditLogEntry {
  id: string
  action_type: string
  description: string
  user_name: string | null
  user_email: string | null
  created_at: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
}

interface AuditLogModalProps {
  applicationId: string
  onClose: () => void
}

const actionTypeColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  status_change: 'bg-purple-100 text-purple-800',
  assign: 'bg-indigo-100 text-indigo-800',
  unassign: 'bg-gray-100 text-gray-800',
  delete: 'bg-red-100 text-red-800',
  other: 'bg-yellow-100 text-yellow-800',
}

const actionTypeLabels: Record<string, string> = {
  create: 'Создание',
  update: 'Изменение',
  status_change: 'Статус',
  assign: 'Назначение',
  unassign: 'Снятие',
  delete: 'Удаление',
  other: 'Действие',
}

export default function AuditLogModal({ applicationId, onClose }: AuditLogModalProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusTranslations, setStatusTranslations] = useState<Record<string, string>>({})

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/applications/${applicationId}/logs`)

      if (!response.ok) {
        throw new Error('Failed to load logs')
      }

      const data = await response.json()
      setLogs(data.logs)
    } catch (error) {
      console.error('Error loading logs:', error)
      setError('Не удалось загрузить историю')
    } finally {
      setIsLoading(false)
    }
  }, [applicationId])

  useEffect(() => {
    loadStatuses()
    loadLogs()
  }, [applicationId, loadLogs])

  async function loadStatuses() {
    try {
      const response = await fetch('/api/statuses')

      if (!response.ok) {
        console.error('Failed to load statuses')
        return
      }

      const data = await response.json()

      const translations: Record<string, string> = {}
      data.statuses.forEach((status: { code: string; name_ru: string }) => {
        translations[status.code] = status.name_ru
      })

      setStatusTranslations(translations)
    } catch (error) {
      console.error('Error loading statuses:', error)
    }
  }

  function translateDescription(description: string): string {
    let translated = description

    Object.entries(statusTranslations).forEach(([eng, rus]) => {
      translated = translated.replace(new RegExp(`"${eng}"`, 'g'), `"${rus}"`)
    })

    return translated
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ]

    const day = date.getDate()
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${day} ${month} ${year}, ${hours}:${minutes}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Полная история изменений</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-600">
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && logs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>История изменений пуста</p>
            </div>
          )}

          {!isLoading && !error && logs.length > 0 && (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border-l-4 border-indigo-500 bg-gray-50 p-4 rounded-r">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${actionTypeColors[log.action_type] || 'bg-gray-100 text-gray-800'}`}>
                          {actionTypeLabels[log.action_type] || log.action_type}
                        </span>
                        <span className="text-sm text-gray-500">{formatDate(log.created_at)}</span>
                      </div>

                      <p className="text-sm text-gray-900 mb-2">{translateDescription(log.description)}</p>

                      {log.user_name && (
                        <p className="text-xs text-gray-600">
                          {log.user_name}
                          {log.user_email && ` (${log.user_email})`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
