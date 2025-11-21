import { NextResponse } from 'next/server'
import { createDirectClient } from '@/lib/supabase-direct'

interface Address {
  id: string
  street: string
  house: string
  comment: string | null
  created_at?: string
  updated_at?: string
}

interface SearchResult extends Address {
  similarity: number
  full_address: string
}

interface RpcSearchResult {
  id: string
  street: string
  house: string
  comment: string | null
  similarity: number
  created_at?: string
  updated_at?: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    const supabase = createDirectClient()

    // Используем pg_trgm для нечеткого поиска
    // similarity() возвращает степень похожести от 0 до 1
    // Ищем по улице и дому одновременно
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: addresses, error } = await (supabase as any).rpc('search_addresses_fuzzy', {
      search_query: query.trim()
    })

    if (error) {
      // Если RPC функция еще не создана, используем простой ILIKE поиск
      console.error('RPC error, falling back to ILIKE search:', error)

      const { data: fallbackAddresses, error: fallbackError } = await supabase
        .from('zakaz_addresses')
        .select('*')
        .or(`street.ilike.%${query}%,house.ilike.%${query}%`)
        .order('street', { ascending: true })
        .order('house', { ascending: true })
        .limit(20)
        .returns<Address[]>()

      if (fallbackError) {
        console.error('Database error:', fallbackError)
        return NextResponse.json(
          { error: 'Failed to search addresses', details: fallbackError.message },
          { status: 500 }
        )
      }

      // Форматируем результаты
      const formattedResults: SearchResult[] = (fallbackAddresses || []).map(addr => ({
        ...addr,
        similarity: 0.5, // Примерное значение для ILIKE поиска
        full_address: `${addr.street}, ${addr.house}`
      }))

      return NextResponse.json({
        addresses: formattedResults,
        fallback: true
      })
    }

    // Форматируем результаты с similarity
    const formattedResults: SearchResult[] = (addresses as RpcSearchResult[] || []).map((addr) => ({
      id: addr.id,
      street: addr.street,
      house: addr.house,
      comment: addr.comment,
      similarity: addr.similarity || 0,
      full_address: `${addr.street}, ${addr.house}`,
      created_at: addr.created_at,
      updated_at: addr.updated_at
    }))

    return NextResponse.json({ addresses: formattedResults })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
