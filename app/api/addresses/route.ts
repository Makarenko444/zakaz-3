import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

export async function GET() {
  try {
    const supabase = createDirectClient()

    // Получаем все адреса (узлы)
    const { data: addresses, error: addressesError } = await supabase
      .from('zakaz_addresses')
      .select('*')
      .order('street', { ascending: true })
      .order('house', { ascending: true })

    if (addressesError) {
      console.error('Database error:', addressesError)
      return NextResponse.json(
        { error: 'Failed to fetch addresses', details: addressesError.message },
        { status: 500 }
      )
    }

    // Для каждого адреса получаем статистику по заявкам
    const addressesWithStats = await Promise.all(
      (addresses || []).map(async (address) => {
        const { data: applications, error: applicationsError } = await supabase
          .from('zakaz_applications')
          .select('id, status, application_number')
          .eq('address_id', address.id)

        if (applicationsError) {
          console.error('Error fetching applications for address:', applicationsError)
          return {
            ...address,
            total_applications: 0,
            status_counts: {},
            applications: []
          }
        }

        // Подсчитываем количество заявок по статусам
        const statusCounts: Record<string, number> = {}
        applications?.forEach(app => {
          statusCounts[app.status] = (statusCounts[app.status] || 0) + 1
        })

        return {
          ...address,
          total_applications: applications?.length || 0,
          status_counts: statusCounts,
          applications: applications || []
        }
      })
    )

    return NextResponse.json({ addresses: addressesWithStats })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
