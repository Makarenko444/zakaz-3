'use client'

import { useEffect, useState, useCallback } from 'react'
import { Material } from '@/lib/types'

export default function MaterialsAdminPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const fetchMaterials = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (!showInactive) params.set('active_only', 'true')
      if (categoryFilter) params.set('category', categoryFilter)

      const res = await fetch(`/api/materials?${params}`)
      const data = await res.json()

      if (res.ok) {
        setMaterials(data.materials || [])
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    } finally {
      setIsLoading(false)
    }
  }, [showInactive, categoryFilter])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  const handleSave = async (data: { name: string; unit: string; category: string }) => {
    try {
      if (editingMaterial) {
        // Обновление
        const res = await fetch('/api/materials', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingMaterial.id, ...data }),
        })
        if (res.ok) {
          setShowModal(false)
          setEditingMaterial(null)
          fetchMaterials()
        }
      } else {
        // Создание
        const res = await fetch('/api/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (res.ok) {
          setShowModal(false)
          fetchMaterials()
        }
      }
    } catch (error) {
      console.error('Error saving material:', error)
    }
  }

  const handleToggleActive = async (material: Material) => {
    try {
      const res = await fetch('/api/materials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: material.id, is_active: !material.is_active }),
      })
      if (res.ok) fetchMaterials()
    } catch (error) {
      console.error('Error toggling material:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить материал из справочника?')) return

    try {
      const res = await fetch(`/api/materials?id=${id}`, { method: 'DELETE' })
      if (res.ok) fetchMaterials()
    } catch (error) {
      console.error('Error deleting material:', error)
    }
  }

  const openEdit = (material: Material) => {
    setEditingMaterial(material)
    setShowModal(true)
  }

  const openCreate = () => {
    setEditingMaterial(null)
    setShowModal(true)
  }

  return (
    <div className="p-6">
      {/* Заголовок */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Справочник материалов</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Добавить материал
        </button>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Категория</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Все категории</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Показать неактивные</span>
          </label>
        </div>
      </div>

      {/* Таблица */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : materials.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          Материалы не найдены
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">№</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Наименование</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ед.изм.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {materials.map((m, idx) => (
                <tr key={m.id} className={!m.is_active ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {m.sort_order || idx + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {m.name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {m.unit}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {m.category || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      m.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {m.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => openEdit(m)}
                      className="text-indigo-600 hover:text-indigo-800 mr-3"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleToggleActive(m)}
                      className="text-gray-600 hover:text-gray-800 mr-3"
                    >
                      {m.is_active ? 'Скрыть' : 'Показать'}
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Итого */}
      <div className="mt-4 text-sm text-gray-500">
        Всего: {materials.length} материалов
      </div>

      {/* Модалка */}
      {showModal && (
        <MaterialModal
          material={editingMaterial}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingMaterial(null) }}
        />
      )}
    </div>
  )
}

// Модалка редактирования/создания
function MaterialModal({
  material,
  categories,
  onSave,
  onClose,
}: {
  material: Material | null
  categories: string[]
  onSave: (data: { name: string; unit: string; category: string }) => void
  onClose: () => void
}) {
  const [name, setName] = useState(material?.name || '')
  const [unit, setUnit] = useState(material?.unit || 'шт')
  const [category, setCategory] = useState(material?.category || '')
  const [newCategory, setNewCategory] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      unit: unit.trim(),
      category: newCategory.trim() || category,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          {material ? 'Редактирование материала' : 'Новый материал'}
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Наименование *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Единица измерения *</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="м">м (метры)</option>
              <option value="шт">шт (штуки)</option>
              <option value="уп">уп (упаковки)</option>
              <option value="кг">кг (килограммы)</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setNewCategory('') }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 mb-2"
            >
              <option value="">Без категории</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => { setNewCategory(e.target.value); setCategory('') }}
              placeholder="или введите новую категорию"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
