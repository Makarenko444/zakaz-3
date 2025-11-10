'use client'

import { useState, useRef } from 'react'

interface FileUploadProps {
  applicationId: string
  commentId?: string | null
  onFileUploaded?: () => void
  maxFiles?: number
  className?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.zip',
  '.rar',
  '.txt',
]

export default function FileUpload({
  applicationId,
  commentId = null,
  onFileUploaded,
  maxFiles = 5,
  className = '',
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (files.length === 0) return

    // Проверка количества файлов
    if (files.length > maxFiles) {
      setError(`Можно загрузить максимум ${maxFiles} файлов за раз`)
      return
    }

    // Валидация каждого файла
    for (const file of files) {
      // Проверка размера
      if (file.size > MAX_FILE_SIZE) {
        setError(`Файл "${file.name}" слишком большой. Максимальный размер: 10 МБ`)
        return
      }

      // Проверка расширения
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError(`Файл "${file.name}" имеет недопустимое расширение`)
        return
      }
    }

    setError('')
    setIsUploading(true)

    try {
      // Загружаем файлы последовательно
      for (const file of files) {
        await uploadFile(file)
      }

      // Сброс input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Вызываем callback
      if (onFileUploaded) {
        onFileUploaded()
      }
    } catch (err) {
      console.error('Error uploading files:', err)
      setError('Ошибка загрузки файлов')
    } finally {
      setIsUploading(false)
      setUploadProgress({})
    }
  }

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    if (commentId) {
      formData.append('comment_id', commentId)
    }

    // Обновляем прогресс
    setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))

    const response = await fetch(`/api/applications/${applicationId}/files`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to upload file')
    }

    // Завершено
    setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Б'
    const k = 1024
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  return (
    <div className={className}>
      {/* Кнопка выбора файлов */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id={`file-upload-${applicationId}-${commentId || 'direct'}`}
        />
        <label
          htmlFor={`file-upload-${applicationId}-${commentId || 'direct'}`}
          className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer ${
            isUploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
          {isUploading ? 'Загрузка...' : 'Прикрепить файл'}
        </label>
        <span className="text-xs text-gray-500">до {formatFileSize(MAX_FILE_SIZE)}</span>
      </div>

      {/* Прогресс загрузки */}
      {isUploading && Object.keys(uploadProgress).length > 0 && (
        <div className="mt-3 space-y-2">
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600 truncate">{fileName}</span>
                <span className="text-gray-500">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Подсказка */}
      <p className="mt-2 text-xs text-gray-500">
        Поддерживаемые форматы: PDF, Word, Excel, изображения (JPG, PNG), архивы (ZIP, RAR), текст
      </p>
    </div>
  )
}
