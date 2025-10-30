import { supabase } from './supabase'
import { User } from './types'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error

  if (data.user) {
    const { data: userData, error: userError } = await supabase
      .from('zakaz_users')
      .select('*')
      .eq('email', email)
      .single()

    if (userError) throw userError

    return { session: data.session, user: userData as User }
  }

  return { session: data.session, user: null }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user?.email) return null

  const { data, error } = await supabase
    .from('zakaz_users')
    .select('*')
    .eq('email', session.user.email)
    .single()

  if (error) return null

  return data as User
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
