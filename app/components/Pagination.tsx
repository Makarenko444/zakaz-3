'use client'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange?: (items: number) => void
  showItemsPerPage?: boolean
  itemsPerPageOptions?: number[]
  className?: string
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = true,
  itemsPerPageOptions = [10, 20, 50, 100],
  className = '',
}: PaginationProps) {
  if (totalItems === 0) return null

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 ${className}`}>
      {/* Информация о показанных записях */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {startItem}–{endItem} из {totalItems}
        </span>

        {/* Выбор количества на странице */}
        {showItemsPerPage && onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Показывать:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {itemsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Кнопки навигации */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* Первая страница */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Первая страница"
          >
            «
          </button>

          {/* Предыдущая страница */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Предыдущая страница"
          >
            ‹
          </button>

          {/* Номер страницы */}
          <span className="px-3 py-1 text-sm text-gray-700">
            {currentPage} / {totalPages}
          </span>

          {/* Следующая страница */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Следующая страница"
          >
            ›
          </button>

          {/* Последняя страница */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Последняя страница"
          >
            »
          </button>
        </div>
      )}
    </div>
  )
}
