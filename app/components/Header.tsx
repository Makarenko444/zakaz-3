'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

interface HeaderProps {
  onLogout: () => void
  isLoggingOut: boolean
  isCollapsed: boolean
}

export default function Header({ onLogout, isLoggingOut, isCollapsed }: HeaderProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/dashboard/applications?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className={`h-14 bg-white border-b border-gray-200 fixed top-0 right-0 z-20 transition-all ${isCollapsed ? 'left-16' : 'left-64'}`}>
      <div className="h-full px-4 flex items-center justify-between">
        {/* Поиск */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по ФИО, телефону, адресу..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>
        </form>

        {/* Правая часть */}
        <div className="flex items-center gap-3 ml-4">
          {/* Кнопка создания заявки */}
          <button
            onClick={() => router.push('/dashboard/applications/new')}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Создать заявку</span>
          </button>

          {/* Уведомления */}
          <button
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition relative"
            aria-label="Уведомления"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </button>

          {/* Переключатель темы */}
          <ThemeToggle />

          {/* Выход */}
          <button
            onClick={onLogout}
            disabled={isLoggingOut}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Выход"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
