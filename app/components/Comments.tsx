'use client'

import { useEffect, useState, useCallback } from 'react'
import FileList from './FileList'
import FileUpload from './FileUpload'

interface Comment {
  id: string
  user_id: string | null
  user_name: string
  user_email: string | null
  comment: string
  created_at: string
  updated_at: string
  reply_to_comment_id: string | null
  replied_comment?: {
    id: string
    user_name: string
    comment: string
  } | null
}

interface CommentsProps {
  applicationId: string
  currentUserId?: string
  currentUserName?: string
  currentUserEmail?: string
  currentUserRole?: string
  onFileUploaded?: () => void  // Callback для обновления главного списка файлов
}

export default function Comments({
  applicationId,
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserRole,
  onFileUploaded
}: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fileRefreshTriggers, setFileRefreshTriggers] = useState<Record<string, number>>({})
  const [showFileUpload, setShowFileUpload] = useState<Record<string, boolean>>({})
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null)
  const [replyToComment, setReplyToComment] = useState<Comment | null>(null)

  const loadComments = useCallback(async () => {
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
  }, [applicationId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

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
          reply_to_comment_id: replyingToCommentId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add comment')
      }

      const data = await response.json()
      const newCommentData = data.comment
      setComments([newCommentData, ...comments])
      setNewComment('')
      setReplyingToCommentId(null)
      setReplyToComment(null)

      // Загрузить файлы к новому комментарию, если они были выбраны
      if (selectedFiles.length > 0) {
        await uploadFilesToComment(newCommentData.id, selectedFiles)
        setSelectedFiles([])
      }
    } catch (error: unknown) {
      console.error('Error adding comment:', error)
      setError(error instanceof Error ? error.message : 'Не удалось добавить комментарий')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function uploadFilesToComment(commentId: string, files: File[]) {
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('comment_id', commentId)

      try {
        const response = await fetch(`/api/applications/${applicationId}/files`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          console.error('Failed to upload file:', file.name)
        }
      } catch (error) {
        console.error('Error uploading file:', error)
      }
    }
    // Обновить список файлов комментария
    refreshFiles(commentId)
    // Обновить главный список файлов заявки
    if (onFileUploaded) {
      onFileUploaded()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files))
    }
  }

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index))
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

  const handleEdit = (comment: Comment) => {
    setEditingCommentId(comment.id)
    setEditingText(comment.comment)
  }

  const handleCancelEdit = () => {
    setEditingCommentId(null)
    setEditingText('')
  }

  const handleUpdateComment = async (commentId: string) => {
    if (!editingText.trim()) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/applications/${applicationId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: editingText,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update comment')
      }

      const data = await response.json()
      // Обновляем комментарий в списке
      setComments(comments.map(c => c.id === commentId ? data.comment : c))
      setEditingCommentId(null)
      setEditingText('')
    } catch (error: unknown) {
      console.error('Error updating comment:', error)
      alert(error instanceof Error ? error.message : 'Не удалось обновить комментарий')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот комментарий?')) {
      return
    }

    try {
      const response = await fetch(`/api/applications/${applicationId}/comments/${commentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete comment')
      }

      // Удаляем комментарий из списка
      setComments(comments.filter(c => c.id !== commentId))
    } catch (error: unknown) {
      console.error('Error deleting comment:', error)
      alert(error instanceof Error ? error.message : 'Не удалось удалить комментарий')
    }
  }

  const canEditComment = (comment: Comment) => {
    return currentUserId && (comment.user_id === currentUserId || currentUserRole === 'admin')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, commentId: string) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleUpdateComment(commentId)
    }
  }

  const handleReply = (comment: Comment) => {
    setReplyingToCommentId(comment.id)
    setReplyToComment(comment)
    // Прокручиваем к форме комментария
    const form = document.querySelector('form')
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // Фокусируем textarea
    setTimeout(() => {
      const textarea = document.querySelector('form textarea') as HTMLTextAreaElement
      if (textarea) {
        textarea.focus()
      }
    }, 300)
  }

  const handleCancelReply = () => {
    setReplyingToCommentId(null)
    setReplyToComment(null)
  }

  const scrollToComment = (commentId: string) => {
    const element = document.getElementById(`comment-${commentId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Подсветка
      element.classList.add('ring-2', 'ring-blue-400')
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-400')
      }, 2000)
    }
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
            <div key={comment.id} id={`comment-${comment.id}`} className="bg-white border border-gray-200 rounded-lg overflow-hidden transition-all">
              {/* Заголовок комментария - отдельный блок */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{comment.user_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {comment.user_email && (
                        <span className="text-xs text-gray-600">{comment.user_email}</span>
                      )}
                      <span className="text-xs text-gray-500">• {formatDate(comment.created_at)}</span>
                      {comment.updated_at !== comment.created_at && (
                        <span className="text-xs text-gray-500">(изменено)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Кнопки редактирования и удаления (только для своих комментариев или админа) */}
                    {canEditComment(comment) && editingCommentId !== comment.id && (
                      <>
                        <button
                          onClick={() => handleEdit(comment)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition"
                          title="Редактировать"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition"
                          title="Удалить"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                    {/* Скрепка для прикрепления файлов (только для своих комментариев или админа) */}
                    {canEditComment(comment) && (
                      <button
                        onClick={() => toggleFileUpload(comment.id)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition"
                        title="Прикрепить файлы"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                          />
                        </svg>
                      </button>
                    )}
                    {/* Кнопка "Ответить" */}
                    <button
                      onClick={() => handleReply(comment)}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded transition"
                      title="Ответить"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Текст комментария или форма редактирования */}
              {editingCommentId === comment.id ? (
                <div className="px-4 py-3 bg-blue-50">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, comment.id)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    disabled={isUpdating}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleUpdateComment(comment.id)}
                      disabled={isUpdating || !editingText.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isUpdating}
                      className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3">
                  {/* Цитата исходного комментария, если это ответ */}
                  {comment.replied_comment && (
                    <div
                      onClick={() => scrollToComment(comment.replied_comment!.id)}
                      className="mb-3 p-3 bg-gray-100 border-l-4 border-blue-400 rounded cursor-pointer hover:bg-gray-200 transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span className="text-xs font-semibold text-blue-600">{comment.replied_comment.user_name}</span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{comment.replied_comment.comment}</p>
                    </div>
                  )}
                  <p className="text-gray-800 whitespace-pre-wrap">{comment.comment}</p>
                </div>
              )}

              {/* Список файлов комментария */}
              {/* Показываем только если есть файлы */}
              <div className="px-4 pb-3">
                <FileList
                  applicationId={applicationId}
                  commentId={comment.id}
                  refreshTrigger={fileRefreshTriggers[comment.id] || 0}
                  showThumbnails={true}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                />
              </div>

              {/* Форма загрузки файлов (показывается по клику на скрепку) */}
              {showFileUpload[comment.id] && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <FileUpload
                    applicationId={applicationId}
                    commentId={comment.id}
                    onFileUploaded={() => {
                      refreshFiles(comment.id)
                      if (onFileUploaded) onFileUploaded()
                    }}
                    maxFiles={3}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Форма добавления комментария */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {replyToComment ? 'Ответить на комментарий' : 'Добавить комментарий'}
            <span className="text-xs text-gray-500 font-normal ml-2">(Ctrl+Enter для отправки)</span>
          </label>

          {/* Цитата при ответе */}
          {replyToComment && (
            <div className="mb-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded relative">
              <button
                type="button"
                onClick={handleCancelReply}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                title="Отменить ответ"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span className="text-xs font-semibold text-blue-600">{replyToComment.user_name}</span>
              </div>
              <p className="text-sm text-gray-700 line-clamp-2">{replyToComment.comment}</p>
            </div>
          )}

          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Напишите комментарий..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            disabled={isSubmitting}
          />
        </div>

        {/* Выбранные файлы */}
        {selectedFiles.length > 0 && (
          <div className="mb-3 space-y-1">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="flex-1">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeSelectedFile(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Иконка скрепки для выбора файлов */}
            <label className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer" title="Прикрепить файлы">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar,.txt"
              />
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
            </label>
            {selectedFiles.length > 0 && (
              <span className="text-xs text-gray-500">{selectedFiles.length} файл(ов)</span>
            )}
          </div>

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
