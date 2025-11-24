import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'
import { Node } from '@/lib/types'

interface Application {
  id: string
  status: string
  application_number: number
}

export async function GET() {
  try {
    const supabase = createDirectClient()

    // Получаем все адреса/узлы из zakaz_nodes
    const { data: nodes, error: nodesError } = await supabase
      .from('zakaz_nodes')
      .select('*')
      .order('street', { ascending: true })
      .order('house', { ascending: true })
      .returns<Node[]>()

    if (nodesError) {
      console.error('Database error:', nodesError)
      return NextResponse.json(
        { error: 'Failed to fetch addresses', details: nodesError.message },
        { status: 500 }
      )
    }

    // Для каждого адреса получаем статистику по заявкам
    const nodesWithStats = await Promise.all(
      (nodes || []).map(async (node) => {
        const { data: applications, error: applicationsError } = await supabase
          .from('zakaz_applications')
          .select('id, status, application_number')
          .eq('node_id', node.id)
          .returns<Application[]>()

        if (applicationsError) {
          console.error('Error fetching applications for node:', applicationsError)
          return {
            ...node,
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
          ...node,
          total_applications: applications?.length || 0,
          status_counts: statusCounts,
          applications: applications || []
        }
      })
    )

    return NextResponse.json({ addresses: nodesWithStats })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
