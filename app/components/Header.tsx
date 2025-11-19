'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-client'
import { User } from '@/lib/types'
import ThemeToggle from '@/components/ThemeToggle'

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [applicationsCount, setApplicationsCount] = useState<number>(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    loadUser()
    loadApplicationsCount()
  }, [])

  async function loadUser() {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Error loading user:', error)
    }
  }

  async function loadApplicationsCount() {
    try {
      const response = await fetch('/api/applications?limit=1')
      if (!response.ok) throw new Error('Failed to load applications count')
      const data = await response.json()
      setApplicationsCount(data.total || 0)
    } catch (error) {
      console.error('Error loading applications count:', error)
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      if (response.ok) {
        router.push('/login')
      } else {
        alert('Не удалось выйти из системы')
      }
    } catch (error) {
      console.error('Error logging out:', error)
      alert('Не удалось выйти из системы')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true
    if (path !== '/dashboard' && pathname.startsWith(path)) return true
    return false
  }

  const roleLabels: Record<string, string> = {
    admin: 'Администратор',
    dispatcher: 'Диспетчер',
    executor: 'Исполнитель',
    client: 'Клиент',
  }

  return (
    <header className="bg-gradient-to-r from-indigo-50 to-white border-b-2 border-indigo-100 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Левая часть - Логотип и навигация */}
          <div className="flex items-center gap-6">
            {/* Логотип */}
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-xl font-bold text-indigo-600 hover:text-indigo-700 transition"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Zakaz 3</span>
            </button>

            {/* Desktop навигация */}
            <nav className="hidden md:flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive('/dashboard') && pathname === '/dashboard'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:scale-105'
                    : 'text-gray-700 hover:bg-gray-200 hover:shadow-md'
                }`}
              >
                Главная
              </button>

              <button
                onClick={() => router.push('/dashboard/applications')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  isActive('/dashboard/applications')
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:scale-105'
                    : 'text-gray-700 hover:bg-gray-200 hover:shadow-md'
                }`}
              >
                Заявки
                {applicationsCount > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    isActive('/dashboard/applications')
                      ? 'bg-white text-indigo-600'
                      : 'bg-indigo-600 text-white'
                  }`}>
                    {applicationsCount}
                  </span>
                )}
              </button>

              {user?.role === 'admin' && (
                <button
                  onClick={() => router.push('/dashboard/admin')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive('/dashboard/admin')
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:scale-105'
                      : 'text-gray-700 hover:bg-gray-200 hover:shadow-md'
                  }`}
                >
                  Админка
                </button>
              )}
            </nav>
          </div>

          {/* Правая часть - Переключатель темы, Пользователь и выход */}
          <div className="flex items-center gap-3">
            {/* Переключатель темы */}
            <ThemeToggle />

            {/* Информация о пользователе */}
            {user && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{user.full_name}</p>
                  <p className="text-xs text-gray-500">{roleLabels[user.role] || user.role}</p>
                </div>
              </div>
            )}

            {/* Кнопка выхода (desktop) */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Выход</span>
            </button>

            {/* Мобильное меню - бургер */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            {/* Информация о пользователе */}
            {user && (
              <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{user.full_name}</p>
                  <p className="text-xs text-gray-500">{roleLabels[user.role] || user.role}</p>
                </div>
              </div>
            )}

            {/* Навигация */}
            <nav className="space-y-1">
              <button
                onClick={() => {
                  router.push('/dashboard')
                  setIsMenuOpen(false)
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive('/dashboard') && pathname === '/dashboard'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
                    : 'text-gray-700 hover:bg-gray-200 hover:shadow-md'
                }`}
              >
                Главная
              </button>

              <button
                onClick={() => {
                  router.push('/dashboard/applications')
                  setIsMenuOpen(false)
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
                  isActive('/dashboard/applications')
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
                    : 'text-gray-700 hover:bg-gray-200 hover:shadow-md'
                }`}
              >
                <span>Заявки</span>
                {applicationsCount > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    isActive('/dashboard/applications')
                      ? 'bg-white text-indigo-600'
                      : 'bg-indigo-600 text-white'
                  }`}>
                    {applicationsCount}
                  </span>
                )}
              </button>

              {user?.role === 'admin' && (
                <button
                  onClick={() => {
                    router.push('/dashboard/admin')
                    setIsMenuOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive('/dashboard/admin')
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
                      : 'text-gray-700 hover:bg-gray-200 hover:shadow-md'
                  }`}
                >
                  Админка
                </button>
              )}

              {/* Переключатель темы в мобильном меню */}
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Тема оформления</span>
                <ThemeToggle />
              </div>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Выход</span>
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
