import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Получаем куки сессии Supabase
  const supabaseToken = request.cookies.get('sb-access-token')

  const isLoginPage = request.nextUrl.pathname === '/login'
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')

  // Если пользователь не авторизован и пытается зайти на защищенную страницу
  if (!supabaseToken && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Если пользователь авторизован и пытается зайти на страницу входа
  if (supabaseToken && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
