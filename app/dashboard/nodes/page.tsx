'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Address {
  id: string
  street: string
  house: string
  comment: string | null
  total_applications: number
  status_counts: Record<string, number>
  applications: Array<{
    id: string
    status: string
    application_number: number
  }>
}

const statusLabelsDefault: Record<string, string> = {
  new: '>20O',
  thinking: 'C<05B',
  estimation: ' 0AGQB',
  waiting_payment: '6840=85 >?;0BK',
  contract: '>3>2>@',
  queue_install: 'G5@54L =0 <>=B06',
  install: '>=B06',
  installed: 'K?>;=5=>',
  rejected: 'B:07',
  no_tech: '5B B5E. 2>7<>6=>AB8',
}

const statusColors: Record<string, string> = {
  new: 'bg-gray-100 text-gray-800',
  thinking: 'bg-blue-100 text-blue-800',
  estimation: 'bg-indigo-100 text-indigo-800',
  waiting_payment: 'bg-amber-100 text-amber-800',
  contract: 'bg-cyan-100 text-cyan-800',
  queue_install: 'bg-purple-100 text-purple-800',
  install: 'bg-violet-100 text-violet-800',
  installed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  no_tech: 'bg-orange-100 text-orange-800',
}

export default function NodesPage() {
  const router = useRouter()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>(statusLabelsDefault)

  useEffect(() => {
    loadStatuses()
    loadAddresses()
  }, [])

  async function loadStatuses() {
    try {
      const response = await fetch('/api/statuses')
      if (!response.ok) {
        throw new Error('Failed to load statuses')
      }
      const data = await response.json()
      const labels: Record<string, string> = {}
      data.statuses.forEach((status: { code: string; name_ru: string }) => {
        labels[status.code] = status.name_ru
      })
      setStatusLabels(labels)
    } catch (error) {
      console.error('Error loading statuses:', error)
      // A?>;L7C5< fallback 7=0G5=8O ?@8 >H81:5
      setStatusLabels(statusLabelsDefault)
    }
  }

  async function loadAddresses() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/addresses')

      if (!response.ok) {
        throw new Error('Failed to load addresses')
      }

      const data = await response.json()
      setAddresses(data.addresses)
    } catch (error) {
      console.error('Error loading addresses:', error)
      setError('5 C40;>AL 703@C78BL A?8A>: C7;>2')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">03@C7:0...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">#7;K ?>4:;NG5=8O</h1>
            </div>
            <div className="text-sm text-gray-600">
              A53> C7;>2: <span className="font-semibold">{addresses.length}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {addresses.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">5B C7;>2</h3>
            <p className="text-gray-600">!?8A>: C7;>2 ?>4:;NG5=8O ?CAB</p>
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <div key={address.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {address.street}, {address.house}
                    </h3>
                    {address.comment && (
                      <p className="text-sm text-gray-600 mt-1">{address.comment}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">A53> 70O2>:</p>
                    <p className="text-2xl font-bold text-gray-900">{address.total_applications}</p>
                  </div>
                </div>

                {address.total_applications > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {Object.entries(address.status_counts).map(([status, count]) => (
                      <div
                        key={status}
                        className={`px-3 py-2 rounded-lg ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}
                      >
                        <p className="text-xs font-medium opacity-80">{statusLabels[status] || status}</p>
                        <p className="text-lg font-bold">{count}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">5B 0:B82=KE 70O2>:</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
