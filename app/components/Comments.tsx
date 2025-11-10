'use client'

import { useEffect, useState } from 'react'
import FileList from './FileList'
import FileUpload from './FileUpload'

interface Comment {
  id: string
  user_name: string
  user_email: string | null
  comment: string
  created_at: string
  updated_at: string
}

interface CommentsProps {
  applicationId: string
  currentUserId?: string
  currentUserName?: string
  currentUserEmail?: string
}

export default function Comments({
  applicationId,
  currentUserId,
  currentUserName,
  currentUserEmail
}: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fileRefreshTriggers, setFileRefreshTriggers] = useState<Record<string, number>>({})
  const [showFileUpload, setShowFileUpload] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadComments()
  }, [applicationId])

  async function loadComments() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/applications/${applicationId}/comments`)

      if (!response.ok) {
        throw new Error('Failed to load comments')
      }

      const data = await response.json()
      setComments(data.comments)
    } catch (error) {
      console.error('Error loading comments:', error)
      setError('Не удалось загрузить комментарии')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!newComment.trim()) return

    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch(`/api/applications/${applicationId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: newComment,
          user_id: currentUserId,
          user_name: currentUserName || 'Аноним',
          user_email: currentUserEmail,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add comment')
      }

      const data = await response.json()
      setComments([...comments, data.comment])
      setNewComment('')
    } catch (error: unknown) {
      console.error('Error adding comment:', error)
      setError(error instanceof Error ? error.message : 'Не удалось добавить комментарий')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const refreshFiles = (commentId: string) => {
    setFileRefreshTriggers(prev => ({
      ...prev,
      [commentId]: (prev[commentId] || 0) + 1
    }))
  }

  const toggleFileUpload = (commentId: string) => {
    setShowFileUpload(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }))
  }

  return (
    <div className="space-y-4">
      {/* Список комментариев */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Комментариев пока нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900">{comment.user_name}</p>
                  {comment.user_email && (
                    <p className="text-xs text-gray-500">{comment.user_email}</p>
                  )}
                </div>
                <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap mb-3">{comment.comment}</p>

              {/* Список файлов комментария */}
              <FileList
                applicationId={applicationId}
                commentId={comment.id}
                refreshTrigger={fileRefreshTriggers[comment.id] || 0}
                className="mt-3"
              />

              {/* Кнопка и форма загрузки файлов */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => toggleFileUpload(comment.id)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  {showFileUpload[comment.id] ? 'Скрыть загрузку файлов' : 'Прикрепить файлы'}
                </button>

                {showFileUpload[comment.id] && (
                  <div className="mt-3">
                    <FileUpload
                      applicationId={applicationId}
                      commentId={comment.id}
                      onFileUploaded={() => refreshFiles(comment.id)}
                      maxFiles={3}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Форма добавления комментария */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Добавить комментарий
          </label>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            placeholder="Напишите комментарий..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            disabled={isSubmitting}
          />
        </div>

        {error && (
          <div className="mb-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Отправка...
              </>
            ) : (
              'Отправить'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
