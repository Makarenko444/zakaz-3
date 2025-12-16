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

export default function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('materials')
  const [materials, setMaterials] = useState<Material[]>([])
  const [templates, setTemplates] = useState<MaterialTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Импорт
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Поиск и фильтры
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [categories, setCategories] = useState<string[]>([])

  // Модальные окна
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MaterialTemplate | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<MaterialTemplate | null>(null)

  const fetchCurrentUser = useCallback(async () => {
    const user = await getCurrentUser()
    setCurrentUser(user)
  }, [])

  const fetchMaterials = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('active_only', 'false') // Показываем все материалы, включая неактивные
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
    fetchTemplates()
  }, [fetchCurrentUser, fetchMaterials, fetchTemplates])

  // Обработчик импорта файла
  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportResult(null)
    setImportError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/materials/import', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Import failed')
      }

      setImportResult(result)

      // Перезагружаем список материалов
      await fetchMaterials()
    } catch (error) {
      console.error('Error importing materials:', error)
      setImportError(String(error))
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
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

  const handleAddItemToTemplate = async (materialId: string | null, materialName: string, unit: string, quantity: number) => {
    if (!selectedTemplate) return
    try {
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
      if (res.ok) {
        fetchTemplateDetails(selectedTemplate.id)
        setShowItemModal(false)
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

  // Форматирование цены
  function formatPrice(price: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price)
  }

  // Форматирование количества
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
              disabled={isImporting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Импорт...
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
              onChange={handleFileUpload}
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
            <button
              onClick={() => setImportResult(null)}
              className="ml-3 text-green-400 hover:text-green-500"
            >
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
              <h3 className="text-sm font-medium text-red-800">Ошибка импорта</h3>
              <p className="mt-1 text-sm text-red-700">{importError}</p>
            </div>
            <button
              onClick={() => setImportError(null)}
              className="ml-3 text-red-400 hover:text-red-500"
            >
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
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {m.code || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {m.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {m.category || '—'}
                      </td>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Список шаблонов */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Шаблоны</h2>
              <button
                onClick={() => {
                  setEditingTemplate(null)
                  setShowTemplateModal(true)
                }}
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
                      selectedTemplate?.id === t.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => fetchTemplateDetails(t.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        {t.description && (
                          <p className="text-sm text-gray-500">{t.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingTemplate(t)
                            setShowTemplateModal(true)
                          }}
                          className="text-gray-400 hover:text-indigo-600"
                          title="Редактировать"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteTemplate(t.id)
                          }}
                          className="text-gray-400 hover:text-red-600"
                          title="Удалить"
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

          {/* Содержимое выбранного шаблона */}
          <div className="bg-white rounded-lg shadow p-6">
            {selectedTemplate ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">{selectedTemplate.name}</h2>
                  <button
                    onClick={() => setShowItemModal(true)}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    + Добавить материал
                  </button>
                </div>
                {selectedTemplate.items && selectedTemplate.items.length > 0 ? (
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-sm font-medium text-gray-500">Материал</th>
                        <th className="text-center py-2 text-sm font-medium text-gray-500 w-20">Кол-во</th>
                        <th className="text-center py-2 text-sm font-medium text-gray-500 w-16">Ед.</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTemplate.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-2">{item.material_name}</td>
                          <td className="py-2 text-center">{item.quantity}</td>
                          <td className="py-2 text-center text-gray-600">{item.unit}</td>
                          <td className="py-2">
                            <button
                              onClick={() => handleRemoveItemFromTemplate(item.id)}
                              className="text-red-500 hover:text-red-700"
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
                  <p className="text-gray-500">В шаблоне нет материалов</p>
                )}
              </>
            ) : (
              <p className="text-gray-500">Выберите шаблон слева</p>
            )}
          </div>
        </div>
      )}

      {/* Модалка создания/редактирования шаблона */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => {
            setShowTemplateModal(false)
            setEditingTemplate(null)
          }}
        />
      )}

      {/* Модалка добавления материала в шаблон */}
      {showItemModal && selectedTemplate && (
        <AddItemModal
          materials={materials}
          onAdd={handleAddItemToTemplate}
          onClose={() => setShowItemModal(false)}
        />
      )}
    </div>
  )
}

// Модалка шаблона
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
        <h3 className="text-lg font-semibold mb-4">
          {template ? 'Редактировать шаблон' : 'Новый шаблон'}
        </h3>
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
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">
            Отмена
          </button>
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

// Модалка добавления материала
function AddItemModal({
  materials,
  onAdd,
  onClose,
}: {
  materials: Material[]
  onAdd: (materialId: string | null, name: string, unit: string, quantity: number) => void
  onClose: () => void
}) {
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [customName, setCustomName] = useState('')
  const [customUnit, setCustomUnit] = useState('шт')
  const [quantity, setQuantity] = useState(1)
  const [useCustom, setUseCustom] = useState(false)

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId)

  const handleSubmit = () => {
    if (useCustom) {
      if (!customName) return
      onAdd(null, customName, customUnit, quantity)
    } else {
      if (!selectedMaterial) return
      onAdd(selectedMaterial.id, selectedMaterial.name, selectedMaterial.unit, quantity)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Добавить материал</h3>

        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
            />
            <span className="text-sm">Свободный ввод</span>
          </label>
        </div>

        {!useCustom ? (
          <select
            value={selectedMaterialId}
            onChange={(e) => setSelectedMaterialId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg mb-4"
          >
            <option value="">Выберите материал</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.unit})
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-3 mb-4">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Название материала"
              className="w-full px-3 py-2 border rounded-lg"
            />
            <input
              type="text"
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              placeholder="Единица измерения"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm text-gray-700 mb-1">Количество</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            min={0}
            step={0.1}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!useCustom && !selectedMaterialId}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}
