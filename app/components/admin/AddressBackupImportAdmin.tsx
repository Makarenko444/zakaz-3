'use client'

import { useState, useRef, useEffect } from 'react'

interface BackupStats {
  total: number
  withOriginalStreet: number
  withOriginalDetails: number
}

export default function AddressBackupImportAdmin() {
  const [ordersFile, setOrdersFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    total: number
    updated: number
    skipped: number
    notFound: number
    errors: number
  } | null>(null)
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isClearing, setIsClearing] = useState(false)

  const ordersInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setIsLoadingStats(true)
    try {
      const response = await fetch('/api/admin/address-backup-import')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  async function handleImport() {
    if (!ordersFile) {
      alert('Выберите файл orders.tsv')
      return
    }

    setIsImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('orders', ordersFile)

      const response = await fetch('/api/admin/address-backup-import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка импорта')
      }

      const result = await response.json()
      setImportResult(result)
      loadStats()
    } catch (error) {
      console.error('Import error:', error)
      alert(`Ошибка импорта: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setIsImporting(false)
    }
  }

  async function handleClear() {
    if (!confirm('Вы уверены, что хотите очистить все оригинальные адреса?\n\nЭто действие нельзя отменить!')) {
      return
    }

    setIsClearing(true)
    try {
      const response = await fetch('/api/admin/address-backup-import', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Ошибка очистки')
      }

      alert('Оригинальные адреса успешно очищены')
      loadStats()
      setImportResult(null)
    } catch (error) {
      console.error('Clear error:', error)
      alert(`Ошибка очистки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Импорт оригинальных адресов
        </h2>
        <p className="text-gray-600">
          Импорт оригинальных значений полей адреса из старой системы в backup-поля для сравнения с нормализованными данными.
        </p>
      </div>

      {/* Статистика */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Статистика заполненности</h3>

        {isLoadingStats ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-500">Всего заявок</h4>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-500">С оригинальным адресом (улица)</h4>
              <p className="text-2xl font-bold text-gray-900">
                {stats.withOriginalStreet}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({stats.total > 0 ? Math.round((stats.withOriginalStreet / stats.total) * 100) : 0}%)
                </span>
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-500">С оригинальными деталями</h4>
              <p className="text-2xl font-bold text-gray-900">
                {stats.withOriginalDetails}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({stats.total > 0 ? Math.round((stats.withOriginalDetails / stats.total) * 100) : 0}%)
                </span>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Не удалось загрузить статистику</p>
        )}

        {/* Кнопка очистки */}
        {stats && (stats.withOriginalStreet > 0 || stats.withOriginalDetails > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleClear}
              disabled={isClearing || isImporting}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearing ? 'Очистка...' : 'Очистить оригинальные адреса'}
            </button>
          </div>
        )}
      </div>

      {/* Загрузка файла */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Загрузка файла</h3>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-indigo-400 transition">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h4 className="mt-2 text-sm font-medium text-gray-900">orders.tsv</h4>
            <p className="mt-1 text-xs text-gray-500">
              Файл заявок с полями: nid, field_all_adres_value, field_all_adres2_value
            </p>

            <input
              ref={ordersInputRef}
              type="file"
              accept=".tsv,.txt"
              className="hidden"
              onChange={(e) => {
                setOrdersFile(e.target.files?.[0] || null)
                setImportResult(null)
              }}
            />

            <button
              onClick={() => ordersInputRef.current?.click()}
              disabled={isImporting}
              className="mt-3 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50"
            >
              {ordersFile ? 'Заменить файл' : 'Выбрать файл'}
            </button>

            {ordersFile && (
              <p className="mt-2 text-sm text-green-600">
                {ordersFile.name}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleImport}
            disabled={!ordersFile || isImporting}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isImporting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Импорт...
              </>
            ) : (
              'Импортировать адреса'
            )}
          </button>
        </div>
      </div>

      {/* Результат импорта */}
      {importResult && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Результат импорта</h3>

          <div className={`p-4 rounded-lg ${importResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Всего записей:</span>
                <p className="font-medium text-gray-900">{importResult.total}</p>
              </div>
              <div>
                <span className="text-green-600">Обновлено:</span>
                <p className="font-medium text-green-700">{importResult.updated}</p>
              </div>
              <div>
                <span className="text-yellow-600">Пропущено:</span>
                <p className="font-medium text-yellow-700">{importResult.skipped}</p>
              </div>
              <div>
                <span className="text-orange-600">Не найдено:</span>
                <p className="font-medium text-orange-700">{importResult.notFound}</p>
              </div>
              <div>
                <span className="text-red-600">Ошибок:</span>
                <p className="font-medium text-red-700">{importResult.errors}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Справка */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Справка</h3>

        <div className="prose prose-sm text-gray-600">
          <p>
            Этот модуль импортирует оригинальные значения адресов из старой системы в поля:
          </p>
          <ul>
            <li><code>street_and_house_original</code> - из поля <code>field_all_adres_value</code></li>
            <li><code>address_details_original</code> - из поля <code>field_all_adres2_value</code></li>
          </ul>
          <p>
            Связь происходит по полю <code>nid</code> (legacy_id в нашей базе).
          </p>
          <p className="text-amber-600">
            Эти поля используются только для справки и сравнения с нормализованными адресами.
            Они не влияют на работу системы.
          </p>
        </div>
      </div>
    </div>
  )
}
