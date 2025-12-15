'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-client'
import { User, ApplicationStatus } from '@/lib/types'

type ViewMode = 'table' | 'cards'

interface CommentItem {
  id: string
  application_id: string
  user_id: string | null
  user_name: string
  user_email: string | null
  comment: string
  reply_to_comment_id: string | null
  created_at: string
  updated_at: string
  application?: {
    id: string
    application_number: number
    customer_fullname: string
    customer_phone: string
    status: string
    city: string
    street_and_house: string | null
    address_details: string | null
  }
  replied_comment?: {
    id: string
    user_name: string
    comment: string
  } | null
  files_count: number
}

interface Stats {
  totalComments: number
  recentComments: number
  weekComments: number
}

// Цвета статусов заявок
const statusColors: Record<ApplicationStatus, string> = {
  new: 'bg-gray-100 text-gray-800',
  thinking: 'bg-blue-100 text-blue-800',
  estimation: 'bg-indigo-100 text-indigo-800',
  estimation_done: 'bg-sky-100 text-sky-800',
  contract: 'bg-cyan-100 text-cyan-800',
  design: 'bg-teal-100 text-teal-800',
  approval: 'bg-emerald-100 text-emerald-800',
  queue_install: 'bg-purple-100 text-purple-800',
  install: 'bg-violet-100 text-violet-800',
  installed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  no_tech: 'bg-orange-100 text-orange-800',
}

const statusLabels: Record<ApplicationStatus, string> = {
  new: 'Новая',
  thinking: 'Думает',
  estimation: 'Расчёт',
  estimation_done: 'Расчёт готов',
  contract: 'Договор',
  design: 'Проект',
  approval: 'Согласование',
  queue_install: 'Очередь',
  install: 'Монтаж',
  installed: 'Выполнено',
  rejected: 'Отказ',
  no_tech: 'Нет ТВ',
}

export default function CommentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const loadComments = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '30',
        sort_by: 'created_at',
        sort_dir: sortDir,
      })
      if (search) {
        params.set('search', search)
      }

      const response = await fetch(`/api/comments?${params}`)
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
        setTotalPages(data.pages || 1)
        setTotal(data.total || 0)
        setStats(data.stats || null)
      }
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setIsLoading(false)
    }
  }, [page, search, sortDir])

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push('/login')
          return
        }
        setUser(currentUser)
      } catch (error) {
        console.error('Error loading user:', error)
        router.push('/login')
      }
    }
    loadUser()
  }, [router])

  useEffect(() => {
    if (user) {
      loadComments()
    }
  }, [user, loadComments])

  function formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '—'
    }
  }

  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'только что'
    if (minutes < 60) return `${minutes} мин. назад`
    if (hours < 24) return `${hours} ч. назад`
    if (days < 7) return `${days} дн. назад`
    return formatDate(dateString)
  }

  function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Всего комментариев</div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalComments}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">За 24 часа</div>
                <div className="text-2xl font-bold text-green-600">{stats.recentComments}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">За неделю</div>
                <div className="text-2xl font-bold text-blue-600">{stats.weekComments}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Заголовок и фильтры */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Комментарии</h1>
            <p className="text-sm text-gray-500 mt-1">Найдено: {total}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Переключатель режима */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-2 text-sm font-medium transition ${
                  viewMode === 'cards'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="Облачка"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="Таблица"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Сортировка */}
            <button
              onClick={() => {
                setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
                setPage(1)
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
            >
              {sortDir === 'desc' ? 'Сначала новые' : 'Сначала старые'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {sortDir === 'desc' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                )}
              </svg>
            </button>

            {/* Поиск */}
            <div className="relative">
              <input
                type="text"
                placeholder="Поиск по тексту или автору..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="w-full sm:w-80 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Список комментариев */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-600">Загрузка комментариев...</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-gray-500">{search ? 'Комментарии не найдены' : 'Нет комментариев'}</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Режим облачков */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition cursor-pointer"
              onClick={() => router.push(`/dashboard/applications/${comment.application_id}`)}
            >
              {/* Шапка карточки - информация о заявке */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-indigo-600">
                      №{comment.application?.application_number || '—'}
                    </span>
                    {comment.application?.status && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[comment.application.status as ApplicationStatus] || 'bg-gray-100 text-gray-800'}`}>
                        {statusLabels[comment.application.status as ApplicationStatus] || comment.application.status}
                      </span>
                    )}
                  </div>
                  {comment.files_count > 0 && (
                    <span className="flex items-center gap-1 text-gray-400" title={`Файлов: ${comment.files_count}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="text-xs">{comment.files_count}</span>
                    </span>
                  )}
                </div>
                {comment.application && (
                  <div className="mt-1">
                    <p className="text-sm text-gray-700 truncate">{comment.application.customer_fullname}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {comment.application.street_and_house || 'Адрес не указан'}
                      {comment.application.address_details && `, ${comment.application.address_details}`}
                    </p>
                  </div>
                )}
              </div>

              {/* Тело комментария */}
              <div className="p-4">
                {/* Цитата если это ответ */}
                {comment.replied_comment && (
                  <div className="mb-3 p-2 bg-gray-100 border-l-3 border-blue-400 rounded text-xs">
                    <span className="font-medium text-blue-600">{comment.replied_comment.user_name}:</span>
                    <p className="text-gray-600 line-clamp-1">{comment.replied_comment.comment}</p>
                  </div>
                )}

                {/* Текст комментария */}
                <div className="relative">
                  <div className="absolute -left-2 top-0 w-1 h-full bg-indigo-200 rounded-full"></div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-4 pl-2">
                    {comment.comment}
                  </p>
                </div>
              </div>

              {/* Футер - автор и время */}
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                      {comment.user_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{comment.user_name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatRelativeTime(comment.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Режим таблицы */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Заявка
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Клиент / Адрес
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Автор
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Комментарий
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Файлы
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {comments.map((comment) => (
                  <tr
                    key={comment.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/dashboard/applications/${comment.application_id}`)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(comment.created_at)}</div>
                      <div className="text-xs text-gray-500">{formatRelativeTime(comment.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-indigo-600">
                          №{comment.application?.application_number || '—'}
                        </span>
                        {comment.application?.status && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[comment.application.status as ApplicationStatus] || 'bg-gray-100 text-gray-800'}`}>
                            {statusLabels[comment.application.status as ApplicationStatus] || comment.application.status}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {comment.application?.customer_fullname || '—'}
                      </div>
                      <div className="text-xs text-gray-500 max-w-xs truncate">
                        {comment.application?.street_and_house || 'Адрес не указан'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                          {comment.user_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-900">{comment.user_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-md">
                        {comment.replied_comment && (
                          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Ответ на: {truncateText(comment.replied_comment.comment, 30)}
                          </div>
                        )}
                        <p className="text-sm text-gray-800 line-clamp-2">{comment.comment}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {comment.files_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {comment.files_count}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow">
          <div className="text-sm text-gray-700">
            Страница {page} из {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Назад
            </button>
            {/* Номера страниц */}
            <div className="hidden sm:flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 rounded text-sm ${
                      page === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
