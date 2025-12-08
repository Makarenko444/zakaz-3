import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from './types'

// Singleton клиент Supabase для серверных операций
// Переиспользуется между запросами для избежания утечки соединений
let supabaseDirectClient: SupabaseClient<Database> | null = null

// Прямое подключение к Supabase для серверных операций
// Не использует куки, работает с service role key
export function createDirectClient(): SupabaseClient<Database> {
  // Возвращаем существующий клиент если он уже создан
  if (supabaseDirectClient) {
    return supabaseDirectClient
  }

  const supabaseUrl = process.env.SUPABASE_DIRECT_URL || 'http://78.140.57.33:8000'
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations')
  }

  supabaseDirectClient = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    // Настройки для стабильной работы
    global: {
      headers: {
        'Connection': 'keep-alive',
      },
    },
  })

  return supabaseDirectClient
}

// Функция для закрытия соединения (для graceful shutdown)
export function closeDirectClient(): void {
  if (supabaseDirectClient) {
    // Supabase JS клиент не имеет явного метода close,
    // но мы можем сбросить ссылку для GC
    supabaseDirectClient = null
  }
}
