import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

// Прямое подключение к Supabase для серверных операций
// Не использует куки, работает с service role key
export function createDirectClient() {
  const supabaseUrl = process.env.SUPABASE_DIRECT_URL || 'http://78.140.57.33:8000'
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations')
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
