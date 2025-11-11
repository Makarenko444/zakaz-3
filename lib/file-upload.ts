import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Базовая директория для хранения файлов
// В production это будет /home/makarenko/zakaz-3-uploads
const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')

// Максимальный размер файла: 10 MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024

// Разрешенные MIME типы
export const ALLOWED_MIME_TYPES = [
  // Документы
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Изображения
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // Архивы
  'application/zip',
  'application/x-rar-compressed',
  // Текст
  'text/plain',
]

/**
 * Генерирует уникальное имя файла
 * Формат: {uuid}_{timestamp}_{sanitized_original_name}
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now()
  const uuid = uuidv4()

  // Получаем расширение файла
  const ext = path.extname(originalFilename)

  // Очищаем имя файла от опасных символов
  const baseName = path.basename(originalFilename, ext)
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_')
    .substring(0, 50) // Ограничиваем длину

  return `${uuid}_${timestamp}_${baseName}${ext}`
}

/**
 * Получает путь к директории для хранения файлов заявки
 */
export function getApplicationUploadDir(applicationId: string): string {
  return path.join(UPLOAD_BASE_DIR, applicationId)
}

/**
 * Получает полный путь к файлу
 */
export function getFilePath(applicationId: string, storedFilename: string): string {
  return path.join(getApplicationUploadDir(applicationId), storedFilename)
}

/**
 * Создает директорию для хранения файлов заявки, если её нет
 */
export async function ensureUploadDirExists(applicationId: string): Promise<void> {
  const uploadDir = getApplicationUploadDir(applicationId)
  try {
    await fs.mkdir(uploadDir, { recursive: true })
  } catch (error) {
    console.error('Error creating upload directory:', error)
    throw new Error('Failed to create upload directory')
  }
}

/**
 * Сохраняет файл на диск
 */
export async function saveFile(
  applicationId: string,
  file: File
): Promise<{ storedFilename: string; filePath: string }> {
  // Генерируем уникальное имя
  const storedFilename = generateUniqueFilename(file.name)

  // Создаем директорию если нужно
  await ensureUploadDirExists(applicationId)

  // Полный путь к файлу
  const filePath = getFilePath(applicationId, storedFilename)

  // Сохраняем файл
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(filePath, buffer)

  return { storedFilename, filePath }
}

/**
 * Удаляет файл с диска
 */
export async function deleteFile(applicationId: string, storedFilename: string): Promise<void> {
  const filePath = getFilePath(applicationId, storedFilename)
  try {
    await fs.unlink(filePath)
  } catch (error) {
    console.error('Error deleting file:', error)
    // Не бросаем ошибку, т.к. файл может быть уже удален
  }
}

/**
 * Проверяет, существует ли файл
 */
export async function fileExists(applicationId: string, storedFilename: string): Promise<boolean> {
  const filePath = getFilePath(applicationId, storedFilename)
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Валидирует файл
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Проверка размера
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Файл слишком большой. Максимальный размер: ${MAX_FILE_SIZE / 1024 / 1024} МБ`,
    }
  }

  // Проверка типа
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Недопустимый тип файла',
    }
  }

  return { valid: true }
}

/**
 * Форматирует размер файла для отображения
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б'

  const k = 1024
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`
}

/**
 * Получает иконку для файла по MIME типу
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('word')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦'
  if (mimeType.startsWith('text/')) return '📃'
  return '📎'
}
