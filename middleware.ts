import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'zakaz_session'

export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')
  const isApiAuth = request.nextUrl.pathname.startsWith('/api/auth')

  // Разрешаем доступ к API auth без проверки
  if (isApiAuth) {
    return NextResponse.next()
  }

  // Проверяем наличие сессии для защищенных страниц
  if (isDashboard && !sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Если пользователь авторизован и пытается зайти на страницу входа
  if (isLoginPage && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/api/auth/:path*'],
}
