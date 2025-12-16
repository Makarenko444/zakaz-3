'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Material, MaterialTemplate, User } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth-client'

type TabType = 'materials' | 'templates'

interface ImportResult {
  success: boolean
  message: string
  stats: {
    total: number
    processed: number
    inserted: number
    updated: number
    duplicates: number
    skipped: number
    errors: number
  }
  details?: {
    duplicates?: Array<{ key: string; reason: string }>
    skipped?: Array<{ row: number; reason: string }>
    errors?: Array<{ row: number; error: string }>
  }
}

interface PreviewData {
  filename: string
  sheetName: string
  totalRows: number
  headers: string[]
  preview: Array<Record<string, unknown>>
}

interface ColumnMapping {
  code: string
  name: string
  unit: string
  price: string
  quantity: string
}

export default function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('materials')
  const [materials, setMaterials] = useState<Material[]>([])
  const [allMaterials, setAllMaterials] = useState<Material[]>([]) // Все материалы для шаблонов
  const [templates, setTemplates] = useState<MaterialTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Импорт
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Предпросмотр
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [noHeaders, setNoHeaders] = useState(false)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    code: '',
    name: '',
    unit: '',
    price: '',
    quantity: '',
  })

  // Поиск и фильтры
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [categories, setCategories] = useState<string[]>([])

  // Модальные окна
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MaterialTemplate | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<MaterialTemplate | null>(null)

  const fetchCurrentUser = useCallback(async () => {
    const user = await getCurrentUser()
    setCurrentUser(user)
  }, [])

  const fetchMaterials = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('active_only', 'false')
      if (searchQuery) params.set('search', searchQuery)
      if (selectedCategory) params.set('category', selectedCategory)

      const res = await fetch(`/api/materials?${params}`)
      const data = await res.json()
      if (res.ok) {
        setMaterials(data.materials || [])
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    }
  }, [searchQuery, selectedCategory])

  // Загрузка всех материалов (для шаблонов, без фильтров)
  const fetchAllMaterials = useCallback(async () => {
    try {
      const res = await fetch('/api/materials?active_only=false')
      const data = await res.json()
      if (res.ok) {
        setAllMaterials(data.materials || [])
      }
    } catch (error) {
      console.error('Error fetching all materials:', error)
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/material-templates')
      const data = await res.json()
      if (res.ok) setTemplates(data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchTemplateDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/material-templates/${id}`)
      const data = await res.json()
      if (res.ok) setSelectedTemplate(data.template)
    } catch (error) {
      console.error('Error fetching template details:', error)
    }
  }

  useEffect(() => {
    fetchCurrentUser()
    fetchMaterials()
    fetchAllMaterials()
    fetchTemplates()
  }, [fetchCurrentUser, fetchMaterials, fetchAllMaterials, fetchTemplates])

  // Автоматическое определение колонок по названиям
  function autoDetectColumns(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = { code: '', name: '', unit: '', price: '', quantity: '' }

    const codePatterns = ['код', 'code', 'артикул', 'id', 'номер']
    const namePatterns = ['наименование', 'название', 'name', 'материал', 'товар', 'номенклатура']
    const unitPatterns = ['ед.изм', 'ед. изм', 'единица', 'unit', 'ед.']
    const pricePatterns = ['цена', 'price', 'стоимость', 'сумма']
    const qtyPatterns = ['остаток', 'количество', 'qty', 'stock', 'кол-во', 'кол.']

    for (const header of headers) {
      const lowerHeader = header.toLowerCase()

      if (!mapping.code && codePatterns.some(p => lowerHeader.includes(p))) {
        mapping.code = header
      }
      if (!mapping.name && namePatterns.some(p => lowerHeader.includes(p))) {
        mapping.name = header
      }
      if (!mapping.unit && unitPatterns.some(p => lowerHeader.includes(p))) {
        mapping.unit = header
      }
      if (!mapping.price && pricePatterns.some(p => lowerHeader.includes(p))) {
        mapping.price = header
      }
      if (!mapping.quantity && qtyPatterns.some(p => lowerHeader.includes(p))) {
        mapping.quantity = header
      }
    }

    return mapping
  }

  // Загрузка предпросмотра файла
  async function loadPreview(file: File, withNoHeaders: boolean) {
    setIsPreviewing(true)
    setImportError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('noHeaders', String(withNoHeaders))

      const response = await fetch('/api/materials/import/preview', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Preview failed')
      }

      setPreviewData(result)
      setColumnMapping(autoDetectColumns(result.headers))
      setShowPreviewModal(true)
    } catch (error) {
      console.error('Error previewing file:', error)
      setImportError(String(error))
    } finally {
      setIsPreviewing(false)
    }
  }

  // Обработчик выбора файла - показываем предпросмотр
  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setNoHeaders(false) // Сбрасываем при выборе нового файла
    await loadPreview(file, false)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Обработчик переключения "без заголовков"
  async function handleNoHeadersChange(checked: boolean) {
    setNoHeaders(checked)
    if (selectedFile) {
      await loadPreview(selectedFile, checked)
    }
  }

  // Импорт с выбранными колонками
  async function handleImport() {
    if (!selectedFile || !columnMapping.name) {
      setImportError('Необходимо выбрать колонку с названием материала')
      return
    }

    setIsImporting(true)
    setShowPreviewModal(false)
    setImportResult(null)
    setImportError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('columnMapping', JSON.stringify(columnMapping))
      formData.append('noHeaders', String(noHeaders))

      const response = await fetch('/api/materials/import', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Import failed')
      }

      setImportResult(result)
      await fetchMaterials()
      await fetchAllMaterials()
    } catch (error) {
      console.error('Error importing materials:', error)
      setImportError(String(error))
    } finally {
      setIsImporting(false)
      setSelectedFile(null)
    }
  }

  function handleClosePreviewModal() {
    setShowPreviewModal(false)
    setPreviewData(null)
    setSelectedFile(null)
  }

  const handleSaveTemplate = async (name: string, description: string) => {
    try {
      if (editingTemplate) {
        const res = await fetch(`/api/material-templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description }),
        })
        if (res.ok) {
          fetchTemplates()
          setShowTemplateModal(false)
          setEditingTemplate(null)
        }
      } else {
        const res = await fetch('/api/material-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description }),
        })
        if (res.ok) {
          fetchTemplates()
          setShowTemplateModal(false)
        }
      }
    } catch (error) {
      console.error('Error saving template:', error)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Удалить шаблон?')) return
    try {
      const res = await fetch(`/api/material-templates/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchTemplates()
        if (selectedTemplate?.id === id) setSelectedTemplate(null)
      }
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const handleAddItemToTemplate = async (materialId: string | null, materialName: string, unit: string, quantity: number | null) => {
    if (!selectedTemplate) {
      console.error('No template selected')
      return
    }
    try {
      console.log('Adding item:', { materialId, materialName, unit, quantity, templateId: selectedTemplate.id })
      const res = await fetch(`/api/material-templates/${selectedTemplate.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: materialId,
          material_name: materialName,
          unit,
          quantity,
        }),
      })
      const data = await res.json()
      console.log('Response:', res.status, data)
      if (res.ok) {
        fetchTemplateDetails(selectedTemplate.id)
      } else {
        console.error('API error:', data)
      }
    } catch (error) {
      console.error('Error adding item:', error)
    }
  }

  const handleRemoveItemFromTemplate = async (itemId: string) => {
    if (!selectedTemplate) return
    try {
      const res = await fetch(`/api/material-templates/${selectedTemplate.id}/items?item_id=${itemId}`, {
        method: 'DELETE',
      })
      if (res.ok) fetchTemplateDetails(selectedTemplate.id)
    } catch (error) {
      console.error('Error removing item:', error)
    }
  }

  const handleUpdateItemQuantity = async (itemId: string, quantity: number | null) => {
    if (!selectedTemplate) return
    try {
      const res = await fetch(`/api/material-templates/${selectedTemplate.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, quantity }),
      })
      if (res.ok) fetchTemplateDetails(selectedTemplate.id)
    } catch (error) {
      console.error('Error updating item:', error)
    }
  }

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    if (!selectedTemplate?.items) return

    const items = [...selectedTemplate.items]
    const currentIndex = items.findIndex(item => item.id === itemId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= items.length) return

    // Меняем местами
    const currentItem = items[currentIndex]
    const swapItem = items[newIndex]

    try {
      // Обновляем sort_order для обоих элементов
      await Promise.all([
        fetch(`/api/material-templates/${selectedTemplate.id}/items`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: currentItem.id, sort_order: swapItem.sort_order }),
        }),
        fetch(`/api/material-templates/${selectedTemplate.id}/items`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: swapItem.id, sort_order: currentItem.sort_order }),
        }),
      ])
      fetchTemplateDetails(selectedTemplate.id)
    } catch (error) {
      console.error('Error moving item:', error)
    }
  }

  function formatPrice(price: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price)
  }

  function formatQuantity(qty: number, unit: string): string {
    const formatted = qty % 1 === 0 ? qty.toString() : qty.toFixed(2)
    return `${formatted} ${unit}`
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Материалы</h1>
        {currentUser?.role === 'admin' && (
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting || isPreviewing}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting || isPreviewing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isPreviewing ? 'Загрузка...' : 'Импорт...'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Импорт из Excel
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Результат импорта */}
      {importResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-800">{importResult.message}</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Всего строк: {importResult.stats.total}</p>
                <p>Обработано: {importResult.stats.processed}</p>
                {importResult.stats.inserted > 0 && <p>Добавлено новых: {importResult.stats.inserted}</p>}
                {importResult.stats.updated > 0 && <p>Обновлено: {importResult.stats.updated}</p>}
                {importResult.stats.duplicates > 0 && <p className="text-yellow-600">Дубликатов: {importResult.stats.duplicates}</p>}
                {importResult.stats.skipped > 0 && <p>Пропущено: {importResult.stats.skipped}</p>}
                {importResult.stats.errors > 0 && <p className="text-red-600">Ошибок: {importResult.stats.errors}</p>}
              </div>
              {importResult.details?.skipped && importResult.details.skipped.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-green-800 hover:text-green-900">
                    Показать пропущенные строки
                  </summary>
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    {importResult.details.skipped.map((item, idx) => (
                      <div key={idx} className="text-xs text-gray-600 py-1">
                        Строка {item.row}: {item.reason}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="ml-3 text-green-400 hover:text-green-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Ошибка импорта */}
      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Ошибка</h3>
              <p className="mt-1 text-sm text-red-700">{importError}</p>
            </div>
            <button onClick={() => setImportError(null)} className="ml-3 text-red-400 hover:text-red-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Табы */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('materials')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'materials'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Справочник материалов ({materials.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Шаблоны наборов
          </button>
        </nav>
      </div>

      {/* Контент табов */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-lg shadow">
          {/* Фильтры */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по названию..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="w-48">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Все категории</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => fetchMaterials()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Поиск
              </button>
              {(searchQuery || selectedCategory) && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>

          {/* Таблица материалов */}
          <div className="overflow-x-auto">
            {materials.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Код</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Цена</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Остаток</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {materials.map((m) => (
                    <tr key={m.id} className={`hover:bg-gray-50 ${!m.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{m.code || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{m.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{m.category || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                        {m.price > 0 ? formatPrice(m.price) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                        {m.stock_quantity > 0 ? formatQuantity(m.stock_quantity, m.unit) : '0'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          m.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {m.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                {isLoading ? 'Загрузка...' : 'Материалы не найдены'}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка - список шаблонов */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Шаблоны</h2>
              <button
                onClick={() => { setEditingTemplate(null); setShowTemplateModal(true) }}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                + Создать
              </button>
            </div>
            {isLoading ? (
              <p className="text-gray-500">Загрузка...</p>
            ) : templates.length > 0 ? (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      selectedTemplate?.id === t.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => fetchTemplateDetails(t.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        {t.description && <p className="text-sm text-gray-500">{t.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingTemplate(t); setShowTemplateModal(true) }}
                          className="text-gray-400 hover:text-indigo-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id) }}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Шаблоны не созданы</p>
            )}
          </div>

          {/* Правая часть - редактирование шаблона */}
          {selectedTemplate ? (
            <TemplateEditor
              template={selectedTemplate}
              materials={allMaterials}
              onAddItem={handleAddItemToTemplate}
              onRemoveItem={handleRemoveItemFromTemplate}
              onUpdateItem={handleUpdateItemQuantity}
              onMoveItem={handleMoveItem}
            />
          ) : (
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 flex items-center justify-center text-gray-500">
              Выберите шаблон слева для редактирования
            </div>
          )}
        </div>
      )}

      {/* Модалка предпросмотра импорта */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Предпросмотр файла: {previewData.filename}</h3>
                <p className="text-sm text-gray-500">Лист: {previewData.sheetName} | Всего строк: {previewData.totalRows}</p>
              </div>
              <button onClick={handleClosePreviewModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Опция "без заголовков" */}
            <div className="px-6 py-3 border-b border-gray-200 bg-amber-50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noHeaders}
                  onChange={(e) => handleNoHeadersChange(e.target.checked)}
                  disabled={isPreviewing}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-amber-800">
                  Первая строка — данные (файл без заголовков)
                </span>
                {isPreviewing && (
                  <svg className="animate-spin h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </label>
            </div>

            {/* Маппинг колонок */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Сопоставление колонок:</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Код</label>
                  <select
                    value={columnMapping.code}
                    onChange={(e) => setColumnMapping({ ...columnMapping, code: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">— не выбрано —</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Наименование *</label>
                  <select
                    value={columnMapping.name}
                    onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">— не выбрано —</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ед. изм.</label>
                  <select
                    value={columnMapping.unit}
                    onChange={(e) => setColumnMapping({ ...columnMapping, unit: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">— не выбрано —</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Цена</label>
                  <select
                    value={columnMapping.price}
                    onChange={(e) => setColumnMapping({ ...columnMapping, price: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">— не выбрано —</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Остаток</label>
                  <select
                    value={columnMapping.quantity}
                    onChange={(e) => setColumnMapping({ ...columnMapping, quantity: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">— не выбрано —</option>
                    {previewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Таблица предпросмотра */}
            <div className="flex-1 overflow-auto p-4">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 border text-left text-xs font-medium text-gray-500">#</th>
                    {previewData.headers.map((header) => (
                      <th
                        key={header}
                        className={`px-2 py-2 border text-left text-xs font-medium ${
                          header === columnMapping.name ? 'bg-green-100 text-green-800' :
                          header === columnMapping.code ? 'bg-blue-100 text-blue-800' :
                          header === columnMapping.unit ? 'bg-purple-100 text-purple-800' :
                          header === columnMapping.price ? 'bg-yellow-100 text-yellow-800' :
                          header === columnMapping.quantity ? 'bg-orange-100 text-orange-800' :
                          'text-gray-500'
                        }`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.preview.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-2 py-1 border text-gray-400">{row.__rowNumber as number}</td>
                      {previewData.headers.map((header) => (
                        <td
                          key={header}
                          className={`px-2 py-1 border ${
                            header === columnMapping.name ? 'bg-green-50' :
                            header === columnMapping.code ? 'bg-blue-50' :
                            header === columnMapping.unit ? 'bg-purple-50' :
                            header === columnMapping.price ? 'bg-yellow-50' :
                            header === columnMapping.quantity ? 'bg-orange-50' :
                            ''
                          }`}
                        >
                          {row[header] !== undefined && row[header] !== null ? String(row[header]) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Кнопки */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleClosePreviewModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleImport}
                disabled={!columnMapping.name || isImporting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isImporting ? 'Импортирую...' : `Импортировать ${previewData.totalRows} строк`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка создания/редактирования шаблона */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => { setShowTemplateModal(false); setEditingTemplate(null) }}
        />
      )}

    </div>
  )
}

function TemplateModal({
  template,
  onSave,
  onClose,
}: {
  template: MaterialTemplate | null
  onSave: (name: string, description: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{template ? 'Редактировать шаблон' : 'Новый шаблон'}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Например: Подключение квартиры"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg h-20"
              placeholder="Описание шаблона (необязательно)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">Отмена</button>
          <button
            onClick={() => onSave(name, description)}
            disabled={!name.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

// Компонент редактирования шаблона с полным списком материалов
function TemplateEditor({
  template,
  materials,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onMoveItem,
}: {
  template: MaterialTemplate
  materials: Material[]
  onAddItem: (materialId: string | null, name: string, unit: string, quantity: number | null) => void
  onRemoveItem: (itemId: string) => void
  onUpdateItem: (itemId: string, quantity: number | null) => void
  onMoveItem: (itemId: string, direction: 'up' | 'down') => void
}) {
  const [searchQuery, setSearchQuery] = useState('')

  // ID материалов уже в шаблоне
  const templateMaterialIds = new Set(
    template.items?.map(item => item.material_id).filter(Boolean) || []
  )

  // Фильтрация материалов по поиску (исключаем уже добавленные)
  const filteredMaterials = materials.filter(m =>
    !templateMaterialIds.has(m.id) && (
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  )

  // Добавить материал
  const addMaterial = (material: Material) => {
    console.log('addMaterial called:', material.id, material.name)
    onAddItem(material.id, material.name, material.unit, null)
  }

  // Обновить количество (с debounce через onBlur)
  const handleQuantityBlur = (itemId: string, value: string) => {
    const qty = value.trim() ? parseFloat(value.replace(',', '.')) : null
    onUpdateItem(itemId, isNaN(qty as number) ? null : qty)
  }

  return (
    <div className="lg:col-span-2 flex flex-col gap-4 h-full">
      {/* Материалы в шаблоне */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{template.name}</h2>
          {template.description && <p className="text-sm text-gray-500">{template.description}</p>}
        </div>

        <div className="p-4">
          {template.items && template.items.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="pb-2 w-16 text-center">Порядок</th>
                  <th className="pb-2">Материал</th>
                  <th className="pb-2 w-24 text-center">Кол-во</th>
                  <th className="pb-2 w-16 text-center">Ед.</th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {template.items.map((item, index) => (
                  <tr key={item.id} className="group">
                    <td className="py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onMoveItem(item.id, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Вверх"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onMoveItem(item.id, 'down')}
                          disabled={index === template.items!.length - 1}
                          className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Вниз"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <span className="text-sm">{item.material_name}</span>
                    </td>
                    <td className="py-2">
                      <input
                        type="text"
                        defaultValue={item.quantity || ''}
                        placeholder="—"
                        onBlur={(e) => handleQuantityBlur(item.id, e.target.value)}
                        className="w-full px-2 py-1 text-sm text-center border border-gray-200 rounded focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 text-center text-sm text-gray-500">{item.unit}</td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Добавьте материалы из списка ниже</p>
          )}
        </div>
      </div>

      {/* Добавление материалов */}
      <div className="bg-white rounded-lg shadow flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-gray-200">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск материалов для добавления..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '300px' }}>
          {filteredMaterials.length > 0 ? (
            <div className="space-y-1">
              {filteredMaterials.map((material) => (
                <div
                  key={material.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 group"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm truncate">{material.name}</p>
                    <p className="text-xs text-gray-400">{material.unit}</p>
                  </div>
                  <button
                    onClick={() => addMaterial(material)}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">
              {searchQuery ? 'Ничего не найдено' : 'Все материалы уже добавлены'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
