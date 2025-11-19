'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-client'
import { User } from '@/lib/types'
import Header from '@/app/components/Header'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [applicationsCount, setApplicationsCount] = useState<number>(0)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

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
    } finally {
      setIsLoading(false)
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Левое меню */}
      <Sidebar user={user} applicationsCount={applicationsCount} />

      {/* Верхняя панель */}
      <Header onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      {/* Основной контент */}
      <main className="ml-64 pt-14 transition-all">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
