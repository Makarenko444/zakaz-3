'use client'

import { useRouter, usePathname } from 'next/navigation'
import { User } from '@/lib/types'

interface SidebarProps {
  user: User | null
  applicationsCount: number
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
}

export default function Sidebar({ user, applicationsCount, isCollapsed, setIsCollapsed }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true
    if (path !== '/dashboard' && pathname.startsWith(path)) return true
    return false
  }

  const menuItems = [
    {
      path: '/dashboard',
      label: 'Главная',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      path: '/dashboard/applications',
      label: 'Заявки',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      badge: applicationsCount,
    },
    {
      path: '/dashboard/nodes',
      label: 'Узлы',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
  ]

  if (user?.role === 'admin') {
    menuItems.push({
      path: '/dashboard/admin',
      label: 'Администрирование',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    })
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-200 transition-all duration-300 z-30 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Логотип */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200">
        {!isCollapsed && (
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-lg font-bold text-indigo-600 hover:text-indigo-700 transition"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Zakaz 3</span>
          </button>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-600 hover:text-gray-900"
          aria-label={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Навигация */}
      <nav className="py-4 px-2">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 ${
              isActive(item.path)
                ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            title={isCollapsed ? item.label : undefined}
          >
            <div className="flex-shrink-0">{item.icon}</div>
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      isActive(item.path)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-100 text-indigo-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      {/* Информация о пользователе внизу */}
      {user && !isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="text-xs overflow-hidden">
              <p className="font-medium text-gray-900 truncate">{user.full_name}</p>
              <p className="text-gray-500 truncate">
                {user.role === 'admin' && 'Администратор'}
                {user.role === 'manager' && 'Менеджер'}
                {user.role === 'engineer' && 'Инженер'}
                {user.role === 'installer' && 'Монтажник'}
                {user.role === 'supply' && 'Снабжение'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Иконка пользователя в свернутом состоянии */}
      {user && isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-gray-200 bg-gray-50 flex justify-center">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
    </aside>
  )
}
