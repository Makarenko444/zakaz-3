'use client'

import { useEffect, useState } from 'react'

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

interface AuditLogProps {
  applicationId: string
  refreshTrigger?: number // Когда меняется - перезагружаем логи
  limit?: number // Ограничение количества записей
  onShowAll?: () => void // Callback для кнопки "Показать все"
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

export default function AuditLog({ applicationId, refreshTrigger, limit, onShowAll }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusTranslations, setStatusTranslations] = useState<Record<string, string>>({})
  const [totalCount, setTotalCount] = useState(0)

  // Загружаем статусы при монтировании компонента
  useEffect(() => {
    loadStatuses()
  }, [])

  useEffect(() => {
    loadLogs()
  }, [applicationId, refreshTrigger])

  async function loadStatuses() {
    try {
      const response = await fetch('/api/statuses')

      if (!response.ok) {
        console.error('Failed to load statuses')
        return
      }

      const data = await response.json()

      // Создаем словарь code -> name_ru
      const translations: Record<string, string> = {}
      data.statuses.forEach((status: { code: string; name_ru: string }) => {
        translations[status.code] = status.name_ru
      })

      setStatusTranslations(translations)
    } catch (error) {
      console.error('Error loading statuses:', error)
    }
  }

  // Функция для перевода статусов в описании
  function translateDescription(description: string): string {
    let translated = description

    // Заменяем английские статусы на русские
    Object.entries(statusTranslations).forEach(([eng, rus]) => {
      // Заменяем статусы в кавычках
      translated = translated.replace(new RegExp(`"${eng}"`, 'g'), `"${rus}"`)
    })

    return translated
  }

  async function loadLogs() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/applications/${applicationId}/logs`)

      if (!response.ok) {
        throw new Error('Failed to load logs')
      }

      const data = await response.json()
      const allLogs = data.logs || []
      setTotalCount(allLogs.length)

      // Применяем limit, если задан
      if (limit && limit > 0) {
        setLogs(allLogs.slice(0, limit))
      } else {
        setLogs(allLogs)
      }
    } catch (error) {
      console.error('Error loading logs:', error)
      setError('Не удалось загрузить историю')
    } finally {
      setIsLoading(false)
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>{error}</p>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>История изменений пуста</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="border-l-4 border-indigo-500 bg-gray-50 p-3 rounded-r">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${actionTypeColors[log.action_type] || 'bg-gray-100 text-gray-800'}`}>
                  {actionTypeLabels[log.action_type] || log.action_type}
                </span>
                <span className="text-xs text-gray-500">{formatDate(log.created_at)}</span>
              </div>

              <p className="text-sm text-gray-900 mb-1">{translateDescription(log.description)}</p>

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

      {/* Кнопка "Показать все", если записей больше чем лимит */}
      {limit && totalCount > limit && onShowAll && (
        <button
          onClick={onShowAll}
          className="w-full py-2 px-4 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition border border-indigo-200"
        >
          Показать все ({totalCount})
        </button>
      )}
    </div>
  )
}
