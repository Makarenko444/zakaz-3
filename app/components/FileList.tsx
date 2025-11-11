'use client'

import { useState, useEffect } from 'react'
import { FileAttachment } from '@/lib/types'

interface FileListProps {
  applicationId: string
  commentId?: string | null
  showDirectFilesOnly?: boolean
  refreshTrigger?: number
  className?: string
}

export default function FileList({
  applicationId,
  commentId,
  showDirectFilesOnly = false,
  refreshTrigger = 0,
  className = '',
}: FileListProps) {
  const [files, setFiles] = useState<FileAttachment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)

  useEffect(() => {
    loadFiles()
  }, [applicationId, commentId, showDirectFilesOnly, refreshTrigger])

  async function loadFiles() {
    setIsLoading(true)
    setError('')

    try {
      let url = `/api/applications/${applicationId}/files`

      if (commentId) {
        url += `?comment_id=${commentId}`
      } else if (showDirectFilesOnly) {
        url += '?comment_id=null'
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to load files')
      }

      const data = await response.json()
      setFiles(data.files || [])
    } catch (err) {
      console.error('Error loading files:', err)
      setError('Не удалось загрузить файлы')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Вы уверены, что хотите удалить этот файл?')) {
      return
    }

    setDeletingFileId(fileId)

    try {
      const response = await fetch(`/api/applications/${applicationId}/files/${fileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      // Обновляем список
      setFiles(files.filter(f => f.id !== fileId))
    } catch (err) {
      console.error('Error deleting file:', err)
      alert('Не удалось удалить файл')
    } finally {
      setDeletingFileId(null)
    }
  }

  const handleDownload = (fileId: string) => {
    // Открываем в новом окне для скачивания
    window.open(`/api/applications/${applicationId}/files/${fileId}`, '_blank')
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Б'
    const k = 1024
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFileIcon = (mimeType: string | null | undefined): string => {
    if (!mimeType) return '📎'
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType === 'application/pdf') return '📄'
    if (mimeType.includes('word')) return '📝'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦'
    if (mimeType.startsWith('text/')) return '📃'
    return '📎'
  }

  if (isLoading) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">Загрузка файлов...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-sm text-red-800">{error}</p>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className={`text-center py-4 text-sm text-gray-500 ${className}`}>
        Файлы не прикреплены
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {files.map(file => (
        <div
          key={file.id}
          className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0">{getFileIcon(file.mime_type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{file.original_filename}</p>
              <p className="text-xs text-gray-500">
                {formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-3">
            <button
              onClick={() => handleDownload(file.id)}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
              title="Скачать"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
            <button
              onClick={() => handleDelete(file.id)}
              disabled={deletingFileId === file.id}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
              title="Удалить"
            >
              {deletingFileId === file.id ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
