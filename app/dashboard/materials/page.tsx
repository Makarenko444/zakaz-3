'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Material, MaterialTemplate, User, Warehouse } from '@/lib/types'
import { getCurrentUser } from '@/lib/auth-client'

type TabType = 'materials' | 'templates' | 'warehouses'

// Уровни активности материалов
const ACTIVITY_LEVELS = [
  { value: 1, label: 'Популярный', color: 'bg-green-100 text-green-800' },
  { value: 2, label: 'Иногда', color: 'bg-blue-100 text-blue-800' },
  { value: 3, label: 'Редко', color: 'bg-yellow-100 text-yellow-800' },
  { value: 4, label: 'Архив', color: 'bg-gray-100 text-gray-500' },
]

function getActivityLevel(level: number) {
  return ACTIVITY_LEVELS.find(l => l.value === level) || ACTIVITY_LEVELS[3]
}

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

interface WarehouseStock {
  id: string
  warehouse_id: string
  material_id: string
  quantity: number
  material?: {
    id: string
    code: string | null
    name: string
    unit: string
    category: string | null
    activity_level: number
    price: number
  }
}

type SortColumn = 'code' | 'name' | 'category' | 'price' | 'stock_quantity' | 'activity_level'
type SortDirection = 'asc' | 'desc'

export default function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('materials')
  const [materials, setMaterials] = useState<Material[]>([])
  const [allMaterials, setAllMaterials] = useState<Material[]>([]) // Все материалы для шаблонов
  const [templates, setTemplates] = useState<MaterialTemplate[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Поиск и фильтры
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedActivityLevel, setSelectedActivityLevel] = useState<string>('')
  const [categories, setCategories] = useState<string[]>([])

  // Сортировка
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Редактирование материала
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [showMaterialModal, setShowMaterialModal] = useState(false)

  // Модальные окна
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MaterialTemplate | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<MaterialTemplate | null>(null)

  // Склады
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([])
  const [isLoadingStocks, setIsLoadingStocks] = useState(false)

  // Импорт остатков склада
  const [stockFile, setStockFile] = useState<File | null>(null)
  const [stockPreviewData, setStockPreviewData] = useState<PreviewData | null>(null)
  const [showStockPreviewModal, setShowStockPreviewModal] = useState(false)
  const [stockColumnMapping, setStockColumnMapping] = useState<ColumnMapping>({
    code: '',
    name: '',
    unit: '',
    price: '',
    quantity: '',
  })
  const [isImportingStock, setIsImportingStock] = useState(false)
  const [stockImportResult, setStockImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Проверка конфликтов при импорте
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false)
  const [stockConflicts, setStockConflicts] = useState<Array<{
    code: string
    existingName: string
    newName: string
  }> | null>(null)
  const [updateNamesOnImport, setUpdateNamesOnImport] = useState(true)

  // Редактирование остатков
  const [editingStockId, setEditingStockId] = useState<string | null>(null)
  const [editingStockQuantity, setEditingStockQuantity] = useState('')

  // Поиск на складе
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState('')

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
      if (selectedActivityLevel) params.set('activity_level', selectedActivityLevel)

      const res = await fetch(`/api/materials?${params}`)
      const data = await res.json()
      if (res.ok) {
        setMaterials(data.materials || [])
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    }
  }, [searchQuery, selectedCategory, selectedActivityLevel])

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

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch('/api/warehouses?active_only=false')
      const data = await res.json()
      if (res.ok) setWarehouses(data.warehouses || [])
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }, [])

  const fetchWarehouseStocks = async (warehouseId: string) => {
    setIsLoadingStocks(true)
    try {
      const res = await fetch(`/api/warehouses/${warehouseId}/stock`)
      const data = await res.json()
      if (res.ok) setWarehouseStocks(data.stocks || [])
    } catch (error) {
      console.error('Error fetching stocks:', error)
    } finally {
      setIsLoadingStocks(false)
    }
  }

  const handleSelectWarehouse = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse)
    fetchWarehouseStocks(warehouse.id)
    setStockImportResult(null)
    setEditingStockId(null)
    setWarehouseSearchQuery('')
  }

  // Фильтрованные остатки склада
  const filteredWarehouseStocks = warehouseStocks.filter(stock => {
    if (!warehouseSearchQuery) return true
    const query = warehouseSearchQuery.toLowerCase()
    return (
      stock.material?.name?.toLowerCase().includes(query) ||
      stock.material?.code?.toLowerCase().includes(query) ||
      stock.material?.category?.toLowerCase().includes(query)
    )
  })

  // Начать редактирование остатка
  const handleStartEditStock = (stockId: string, currentQuantity: number) => {
    setEditingStockId(stockId)
    setEditingStockQuantity(currentQuantity.toString())
  }

  // Сохранить изменение остатка
  const handleSaveStockQuantity = async (stockId: string) => {
    if (!selectedWarehouse) return

    const quantity = parseFloat(editingStockQuantity.replace(',', '.'))
    if (isNaN(quantity) || quantity < 0) {
      setEditingStockId(null)
      return
    }

    try {
      const res = await fetch(`/api/warehouses/${selectedWarehouse.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: stockId, quantity }),
      })

      if (res.ok) {
        fetchWarehouseStocks(selectedWarehouse.id)
        fetchMaterials() // Обновить общие остатки
      }
    } catch (error) {
      console.error('Error updating stock:', error)
    } finally {
      setEditingStockId(null)
    }
  }

  // Отмена редактирования
  const handleCancelEditStock = () => {
    setEditingStockId(null)
    setEditingStockQuantity('')
  }

  const handleSaveWarehouse = async (name: string, code: string, address: string) => {
    try {
      if (editingWarehouse) {
        const res = await fetch('/api/warehouses', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingWarehouse.id, name, code, address }),
        })
        if (res.ok) {
          fetchWarehouses()
          setShowWarehouseModal(false)
          setEditingWarehouse(null)
        }
      } else {
        const res = await fetch('/api/warehouses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, code, address }),
        })
        if (res.ok) {
          fetchWarehouses()
          setShowWarehouseModal(false)
        }
      }
    } catch (error) {
      console.error('Error saving warehouse:', error)
    }
  }

  const handleDeleteWarehouse = async (id: string) => {
    if (!confirm('Удалить склад? Все остатки будут удалены.')) return
    try {
      const res = await fetch(`/api/warehouses?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchWarehouses()
        if (selectedWarehouse?.id === id) {
          setSelectedWarehouse(null)
          setWarehouseStocks([])
        }
      }
    } catch (error) {
      console.error('Error deleting warehouse:', error)
    }
  }

  const handleToggleWarehouseActive = async (warehouse: Warehouse) => {
    try {
      const res = await fetch('/api/warehouses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: warehouse.id, is_active: !warehouse.is_active }),
      })
      if (res.ok) fetchWarehouses()
    } catch (error) {
      console.error('Error toggling warehouse:', error)
    }
  }

  // Импорт остатков склада
  const handleStockFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedWarehouse) return

    setStockFile(file)
    setStockImportResult(null)
    setStockConflicts(null)
    setUpdateNamesOnImport(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('noHeaders', 'false')

      const response = await fetch('/api/materials/import/preview', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      setStockPreviewData(result)
      // Используем общий автодетект колонок
      setStockColumnMapping(autoDetectColumns(result.headers))
      setShowStockPreviewModal(true)
    } catch (error) {
      console.error('Error previewing stock file:', error)
      setImportError(String(error))
    }

    if (event.target) event.target.value = ''
  }

  // Проверка конфликтов названий
  const handleCheckConflicts = async () => {
    if (!stockFile || !selectedWarehouse || !stockColumnMapping.code || !stockColumnMapping.name) return

    setIsCheckingConflicts(true)

    try {
      const formData = new FormData()
      formData.append('file', stockFile)
      formData.append('columnMapping', JSON.stringify(stockColumnMapping))

      const response = await fetch(`/api/warehouses/${selectedWarehouse.id}/stock/check-conflicts`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      setStockConflicts(result.conflicts || [])
      // Если есть конфликты, по умолчанию НЕ обновляем названия
      if (result.conflicts && result.conflicts.length > 0) {
        setUpdateNamesOnImport(false)
      }
    } catch (error) {
      console.error('Error checking conflicts:', error)
      setImportError(String(error))
    } finally {
      setIsCheckingConflicts(false)
    }
  }

  const handleImportStock = async () => {
    if (!stockFile || !selectedWarehouse || !stockColumnMapping.code || !stockColumnMapping.quantity) return

    setIsImportingStock(true)
    setShowStockPreviewModal(false)

    try {
      const formData = new FormData()
      formData.append('file', stockFile)
      formData.append('columnMapping', JSON.stringify(stockColumnMapping))
      formData.append('options', JSON.stringify({ updateNames: updateNamesOnImport }))

      const response = await fetch(`/api/warehouses/${selectedWarehouse.id}/stock/import`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      setStockImportResult(result)
      fetchWarehouseStocks(selectedWarehouse.id)
      // Обновляем справочник материалов, т.к. могли быть созданы новые
      fetchMaterials()
      fetchAllMaterials()
    } catch (error) {
      console.error('Error importing stock:', error)
      setImportError(String(error))
    } finally {
      setIsImportingStock(false)
      setStockFile(null)
    }
  }

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
    fetchWarehouses()
  }, [fetchCurrentUser, fetchMaterials, fetchAllMaterials, fetchTemplates, fetchWarehouses])

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

  // Сортировка материалов
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedMaterials = [...materials].sort((a, b) => {
    let aVal: string | number = ''
    let bVal: string | number = ''

    switch (sortColumn) {
      case 'code':
        aVal = a.code || ''
        bVal = b.code || ''
        break
      case 'name':
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
        break
      case 'category':
        aVal = a.category || ''
        bVal = b.category || ''
        break
      case 'price':
        aVal = a.price || 0
        bVal = b.price || 0
        break
      case 'stock_quantity':
        aVal = a.stock_quantity || 0
        bVal = b.stock_quantity || 0
        break
      case 'activity_level':
        aVal = a.activity_level || 2
        bVal = b.activity_level || 2
        break
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Быстрое изменение уровня активности
  const handleActivityLevelChange = async (material: Material, newLevel: number) => {
    try {
      const res = await fetch('/api/materials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: material.id, activity_level: newLevel }),
      })
      if (res.ok) {
        fetchMaterials()
        fetchAllMaterials()
      }
    } catch (error) {
      console.error('Error updating activity level:', error)
    }
  }

  // Сохранение материала (создание или редактирование)
  const handleSaveMaterial = async (data: { name: string; code: string; unit: string; price: number; category: string; activity_level: number }, isNew?: boolean) => {
    try {
      if (isNew) {
        // Создание нового материала
        const res = await fetch('/api/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, is_manual: true }),
        })
        if (res.ok) {
          fetchMaterials()
          fetchAllMaterials()
          setShowMaterialModal(false)
          setEditingMaterial(null)
        }
      } else if (editingMaterial) {
        // Редактирование существующего
        const res = await fetch('/api/materials', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingMaterial.id, ...data }),
        })
        if (res.ok) {
          fetchMaterials()
          fetchAllMaterials()
          setShowMaterialModal(false)
          setEditingMaterial(null)
        }
      }
    } catch (error) {
      console.error('Error saving material:', error)
    }
  }

  // Проверка, является ли материал созданным вручную
  const isManualMaterial = (code: string | null | undefined): boolean => {
    return code?.startsWith('99999') || false
  }

  // Компонент заголовка с сортировкой
  const SortableHeader = ({ column, label, align = 'left' }: { column: SortColumn; label: string; align?: 'left' | 'right' | 'center' }) => (
    <th
      onClick={() => handleSort(column)}
      className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {label}
        {sortColumn === column && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        )}
      </div>
    </th>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Материалы</h1>

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
          <button
            onClick={() => setActiveTab('warehouses')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'warehouses'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Склады ({warehouses.length})
          </button>
        </nav>
      </div>

      {/* Контент табов */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-lg shadow">
          {/* Заголовок с кнопкой создания */}
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Материалы с кодом <code className="bg-orange-100 text-orange-700 px-1 rounded">99999...</code> добавлены вручную
            </div>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => { setEditingMaterial(null); setShowMaterialModal(true) }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Добавить материал
              </button>
            )}
          </div>

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
              <div className="w-40">
                <select
                  value={selectedActivityLevel}
                  onChange={(e) => setSelectedActivityLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Все уровни</option>
                  {ACTIVITY_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => fetchMaterials()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Поиск
              </button>
              {(searchQuery || selectedCategory || selectedActivityLevel) && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('')
                    setSelectedActivityLevel('')
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
            {sortedMaterials.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <SortableHeader column="code" label="Код" />
                    <SortableHeader column="name" label="Наименование" />
                    <SortableHeader column="category" label="Категория" />
                    <SortableHeader column="price" label="Цена" align="right" />
                    <SortableHeader column="stock_quantity" label="Остаток" align="right" />
                    <SortableHeader column="activity_level" label="Активность" align="center" />
                    {currentUser?.role === 'admin' && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                        Действия
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedMaterials.map((m) => {
                    const actLevel = getActivityLevel(m.activity_level || 2)
                    return (
                      <tr key={m.id} className={`hover:bg-gray-50 ${m.activity_level === 4 ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {m.code ? (
                            isManualMaterial(m.code) ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs font-mono">{m.code}</span>
                                <span className="text-orange-500" title="Добавлен вручную">*</span>
                              </span>
                            ) : (
                              <span className="text-gray-500">{m.code}</span>
                            )
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{m.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{m.category || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          {m.price > 0 ? formatPrice(m.price) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          {m.stock_quantity > 0 ? (
                            <div className="relative group inline-block">
                              <span className="cursor-help border-b border-dashed border-gray-400">
                                {formatQuantity(m.stock_quantity, m.unit)}
                              </span>
                              {m.stocks_by_warehouse && m.stocks_by_warehouse.length > 0 && (
                                <div className="absolute z-50 bottom-full right-0 mb-2 hidden group-hover:block">
                                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                                    <div className="font-medium mb-1 border-b border-gray-700 pb-1">Остатки по складам:</div>
                                    {m.stocks_by_warehouse.map((s, idx) => (
                                      <div key={idx} className="flex justify-between gap-4 py-0.5">
                                        <span className="text-gray-300">{s.warehouse_name}:</span>
                                        <span className="font-medium">{s.quantity} {m.unit}</span>
                                      </div>
                                    ))}
                                    <div className="absolute -bottom-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : '0'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {currentUser?.role === 'admin' ? (
                            <div className="inline-flex items-center gap-1">
                              {ACTIVITY_LEVELS.map((level) => (
                                <button
                                  key={level.value}
                                  onClick={() => handleActivityLevelChange(m, level.value)}
                                  title={level.label}
                                  className={`w-6 h-6 rounded text-xs font-bold transition-all ${
                                    m.activity_level === level.value
                                      ? level.color + ' ring-2 ring-offset-1 ring-indigo-400'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  {level.value}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actLevel.color}`}>
                              {actLevel.label}
                            </span>
                          )}
                        </td>
                        {currentUser?.role === 'admin' && (
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={() => { setEditingMaterial(m); setShowMaterialModal(true) }}
                              className="text-gray-400 hover:text-indigo-600"
                              title="Редактировать"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
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

      {activeTab === 'warehouses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка - список складов */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Склады</h2>
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => { setEditingWarehouse(null); setShowWarehouseModal(true) }}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  + Добавить
                </button>
              )}
            </div>
            {warehouses.length > 0 ? (
              <div className="space-y-2">
                {warehouses.map((w) => (
                  <div
                    key={w.id}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      selectedWarehouse?.id === w.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                    } ${!w.is_active ? 'opacity-50' : ''}`}
                    onClick={() => handleSelectWarehouse(w)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{w.name}</p>
                        {w.code && <p className="text-xs text-gray-400">Код: {w.code}</p>}
                        {w.address && <p className="text-sm text-gray-500">{w.address}</p>}
                      </div>
                      {currentUser?.role === 'admin' && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingWarehouse(w); setShowWarehouseModal(true) }}
                            className="text-gray-400 hover:text-indigo-600"
                            title="Редактировать"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleWarehouseActive(w) }}
                            className={`${w.is_active ? 'text-gray-400 hover:text-orange-600' : 'text-orange-400 hover:text-green-600'}`}
                            title={w.is_active ? 'Деактивировать' : 'Активировать'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {w.is_active ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              )}
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteWarehouse(w.id) }}
                            className="text-gray-400 hover:text-red-600"
                            title="Удалить"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Склады не созданы</p>
            )}
          </div>

          {/* Правая часть - остатки склада */}
          {selectedWarehouse ? (
            <div className="lg:col-span-2 bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedWarehouse.name}</h2>
                    <p className="text-sm text-gray-500">Остатки материалов ({filteredWarehouseStocks.length})</p>
                  </div>
                  {currentUser?.role === 'admin' && (
                    <div>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleStockFileSelect}
                        className="hidden"
                        id="stock-file-input"
                      />
                      <label
                        htmlFor="stock-file-input"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                      >
                      {isImportingStock ? (
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
                          Импорт остатков
                        </>
                      )}
                    </label>
                    </div>
                  )}
                </div>
                {/* Поиск по складу */}
                <input
                  type="text"
                  value={warehouseSearchQuery}
                  onChange={(e) => setWarehouseSearchQuery(e.target.value)}
                  placeholder="Поиск по коду, названию или категории..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* Результат импорта остатков */}
              {stockImportResult && (
                <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="ml-3 flex-1">
                      <p className="text-sm text-green-800">{stockImportResult.message}</p>
                      <p className="text-xs text-green-700 mt-1">
                        Всего: {stockImportResult.stats.total}, Обработано: {stockImportResult.stats.processed}, Пропущено: {stockImportResult.stats.skipped}
                        {stockImportResult.stats.errors > 0 && <span className="text-red-600">, Ошибок: {stockImportResult.stats.errors}</span>}
                      </p>
                    </div>
                    <button onClick={() => setStockImportResult(null)} className="text-green-400 hover:text-green-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Таблица остатков */}
              <div className="overflow-x-auto">
                {isLoadingStocks ? (
                  <div className="p-8 text-center text-gray-500">Загрузка...</div>
                ) : filteredWarehouseStocks.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Код</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Цена</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Остаток</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Активность</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredWarehouseStocks.map((stock) => {
                        const actLevel = getActivityLevel(stock.material?.activity_level || 2)
                        const isEditing = editingStockId === stock.id
                        return (
                          <tr key={stock.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{stock.material?.code || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{stock.material?.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">
                              {(stock.material?.price || 0) > 0 ? formatPrice(stock.material?.price || 0) : '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="text"
                                    value={editingStockQuantity}
                                    onChange={(e) => setEditingStockQuantity(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveStockQuantity(stock.id)
                                      if (e.key === 'Escape') handleCancelEditStock()
                                    }}
                                    autoFocus
                                    className="w-20 px-2 py-1 text-sm text-right border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                  <button
                                    onClick={() => handleSaveStockQuantity(stock.id)}
                                    className="p-1 text-green-600 hover:text-green-700"
                                    title="Сохранить"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={handleCancelEditStock}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                    title="Отмена"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2 group">
                                  <span className="font-medium text-gray-900">
                                    {formatQuantity(stock.quantity, stock.material?.unit || '')}
                                  </span>
                                  {currentUser?.role === 'admin' && (
                                    <button
                                      onClick={() => handleStartEditStock(stock.id, stock.quantity)}
                                      className="p-1 text-gray-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Изменить количество"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actLevel.color}`}>
                                {actLevel.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    {warehouseSearchQuery
                      ? 'Ничего не найдено по запросу'
                      : 'Нет остатков. Импортируйте данные из Excel.'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 flex items-center justify-center text-gray-500">
              Выберите склад слева для просмотра остатков
            </div>
          )}
        </div>
      )}

      {/* Модалка создания/редактирования материала */}
      {showMaterialModal && (
        <MaterialModal
          material={editingMaterial}
          categories={categories}
          onSave={handleSaveMaterial}
          onClose={() => { setShowMaterialModal(false); setEditingMaterial(null) }}
        />
      )}

      {/* Модалка создания/редактирования шаблона */}
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => { setShowTemplateModal(false); setEditingTemplate(null) }}
        />
      )}

      {/* Модалка создания/редактирования склада */}
      {showWarehouseModal && (
        <WarehouseModal
          warehouse={editingWarehouse}
          onSave={handleSaveWarehouse}
          onClose={() => { setShowWarehouseModal(false); setEditingWarehouse(null) }}
        />
      )}

      {/* Модалка предпросмотра импорта остатков */}
      {showStockPreviewModal && stockPreviewData && selectedWarehouse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Импорт остатков: {selectedWarehouse.name}</h3>
                <p className="text-sm text-gray-500">Файл: {stockPreviewData.filename} | Строк: {stockPreviewData.totalRows}</p>
              </div>
              <button onClick={() => { setShowStockPreviewModal(false); setStockFile(null) }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Маппинг колонок для остатков */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Сопоставление колонок:</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Код *</label>
                  <select
                    value={stockColumnMapping.code}
                    onChange={(e) => setStockColumnMapping({ ...stockColumnMapping, code: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">— не выбрано —</option>
                    {stockPreviewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Наименование *</label>
                  <select
                    value={stockColumnMapping.name}
                    onChange={(e) => setStockColumnMapping({ ...stockColumnMapping, name: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">— не выбрано —</option>
                    {stockPreviewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ед. изм.</label>
                  <select
                    value={stockColumnMapping.unit}
                    onChange={(e) => setStockColumnMapping({ ...stockColumnMapping, unit: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">— не выбрано —</option>
                    {stockPreviewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Цена</label>
                  <select
                    value={stockColumnMapping.price}
                    onChange={(e) => setStockColumnMapping({ ...stockColumnMapping, price: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">— не выбрано —</option>
                    {stockPreviewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Остаток *</label>
                  <select
                    value={stockColumnMapping.quantity}
                    onChange={(e) => setStockColumnMapping({ ...stockColumnMapping, quantity: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    <option value="">— не выбрано —</option>
                    {stockPreviewData.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Новые материалы будут созданы в справочнике. Существующие обновятся по коду.
              </p>
            </div>

            {/* Таблица предпросмотра */}
            <div className="flex-1 overflow-auto p-4">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 border text-left text-xs font-medium text-gray-500">#</th>
                    {stockPreviewData.headers.map((header) => (
                      <th
                        key={header}
                        className={`px-2 py-2 border text-left text-xs font-medium ${
                          header === stockColumnMapping.name ? 'bg-green-100 text-green-800' :
                          header === stockColumnMapping.code ? 'bg-blue-100 text-blue-800' :
                          header === stockColumnMapping.unit ? 'bg-purple-100 text-purple-800' :
                          header === stockColumnMapping.price ? 'bg-yellow-100 text-yellow-800' :
                          header === stockColumnMapping.quantity ? 'bg-orange-100 text-orange-800' :
                          'text-gray-500'
                        }`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stockPreviewData.preview.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-2 py-1 border text-gray-400">{row.__rowNumber as number}</td>
                      {stockPreviewData.headers.map((header) => (
                        <td
                          key={header}
                          className={`px-2 py-1 border ${
                            header === stockColumnMapping.name ? 'bg-green-50' :
                            header === stockColumnMapping.code ? 'bg-blue-50' :
                            header === stockColumnMapping.unit ? 'bg-purple-50' :
                            header === stockColumnMapping.price ? 'bg-yellow-50' :
                            header === stockColumnMapping.quantity ? 'bg-orange-50' :
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

            {/* Секция конфликтов */}
            {stockConflicts !== null && (
              <div className="px-6 py-4 border-t border-gray-200">
                {stockConflicts.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800">
                          Найдено {stockConflicts.length} материалов с изменёнными названиями:
                        </p>
                        <div className="mt-2 max-h-32 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-amber-700">
                                <th className="text-left py-1">Код</th>
                                <th className="text-left py-1">В базе</th>
                                <th className="text-left py-1">В файле</th>
                              </tr>
                            </thead>
                            <tbody className="text-amber-900">
                              {stockConflicts.slice(0, 10).map((c, i) => (
                                <tr key={i} className="border-t border-amber-200">
                                  <td className="py-1 font-mono">{c.code}</td>
                                  <td className="py-1">{c.existingName}</td>
                                  <td className="py-1">{c.newName}</td>
                                </tr>
                              ))}
                              {stockConflicts.length > 10 && (
                                <tr className="border-t border-amber-200">
                                  <td colSpan={3} className="py-1 text-amber-600">...и ещё {stockConflicts.length - 10}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={!updateNamesOnImport}
                              onChange={() => setUpdateNamesOnImport(false)}
                              className="w-4 h-4 text-indigo-600"
                            />
                            <span className="text-sm text-amber-800">Оставить названия как в базе</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={updateNamesOnImport}
                              onChange={() => setUpdateNamesOnImport(true)}
                              className="w-4 h-4 text-indigo-600"
                            />
                            <span className="text-sm text-amber-800">Обновить названия из файла</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-green-800">Конфликтов названий не обнаружено</span>
                  </div>
                )}
              </div>
            )}

            {/* Кнопки */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <div>
                {stockConflicts === null && stockColumnMapping.code && stockColumnMapping.name && (
                  <button
                    onClick={handleCheckConflicts}
                    disabled={isCheckingConflicts}
                    className="px-4 py-2 border border-amber-300 text-amber-700 rounded-md hover:bg-amber-50 disabled:opacity-50"
                  >
                    {isCheckingConflicts ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Проверяю...
                      </>
                    ) : (
                      'Проверить конфликты'
                    )}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowStockPreviewModal(false); setStockFile(null); setStockConflicts(null) }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleImportStock}
                  disabled={!stockColumnMapping.code || !stockColumnMapping.name || !stockColumnMapping.quantity || isImportingStock}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isImportingStock ? 'Импортирую...' : `Импортировать ${stockPreviewData.totalRows} строк`}
                </button>
              </div>
            </div>
          </div>
        </div>
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
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{material.unit}</span>
                      {material.price > 0 && (
                        <span className="text-gray-500">{material.price.toLocaleString('ru-RU')} ₽</span>
                      )}
                      {material.stock_quantity > 0 && (
                        <span className="text-green-600">в наличии: {material.stock_quantity}</span>
                      )}
                    </div>
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

function WarehouseModal({
  warehouse,
  onSave,
  onClose,
}: {
  warehouse: Warehouse | null
  onSave: (name: string, code: string, address: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(warehouse?.name || '')
  const [code, setCode] = useState(warehouse?.code || '')
  const [address, setAddress] = useState(warehouse?.address || '')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{warehouse ? 'Редактировать склад' : 'Новый склад'}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Например: Основной склад"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Код</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Уникальный код склада"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg h-20"
              placeholder="Адрес склада (необязательно)"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">Отмена</button>
          <button
            onClick={() => onSave(name, code, address)}
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

function MaterialModal({
  material,
  categories,
  onSave,
  onClose,
}: {
  material: Material | null
  categories: string[]
  onSave: (data: { name: string; code: string; unit: string; price: number; category: string; activity_level: number }, isNew?: boolean) => void
  onClose: () => void
}) {
  const isNew = !material
  const [name, setName] = useState(material?.name || '')
  const [code, setCode] = useState(material?.code || '')
  const [unit, setUnit] = useState(material?.unit || 'шт')
  const [price, setPrice] = useState(material?.price?.toString() || '')
  const [category, setCategory] = useState(material?.category || '')
  const [activityLevel, setActivityLevel] = useState(material?.activity_level || 2)

  const handleSubmit = () => {
    onSave({
      name,
      code,
      unit,
      price: parseFloat(price.replace(',', '.')) || 0,
      category,
      activity_level: activityLevel,
    }, isNew)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h3 className="text-lg font-semibold mb-4">
          {isNew ? 'Добавить материал' : 'Редактирование материала'}
        </h3>

        {isNew && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                Материалу будет автоматически присвоен уникальный код <code className="bg-orange-100 px-1 rounded">99999...</code>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Наименование *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Например: Кабель UTP Cat5e"
              />
            </div>
            {!isNew && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Код</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                  readOnly={code?.startsWith('99999')}
                />
              </div>
            )}
            <div className={isNew ? '' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ед. изм. *</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="шт, м, кг..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Цена</label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="categories-list"
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Кабели, Коннекторы..."
              />
              <datalist id="categories-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Уровень активности</label>
            <div className="flex gap-2">
              {[
                { value: 1, label: 'Популярный', color: 'bg-green-100 text-green-800 border-green-300' },
                { value: 2, label: 'Иногда', color: 'bg-blue-100 text-blue-800 border-blue-300' },
                { value: 3, label: 'Редко', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                { value: 4, label: 'Архив', color: 'bg-gray-100 text-gray-500 border-gray-300' },
              ].map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setActivityLevel(level.value)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    activityLevel === level.value
                      ? level.color + ' ring-2 ring-indigo-400'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">Отмена</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !unit.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
          >
            {isNew ? 'Добавить' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
