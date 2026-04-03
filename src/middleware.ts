import { NextRequest, NextResponse } from 'next/server'
import { isAuthEnabled, hasValidCookie, isValidToken, createAuthCookie } from '@/lib/auth'

export function middleware(request: NextRequest) {
  // Skip auth if APP_SECRET is not configured (local dev)
  if (!isAuthEnabled()) {
    return NextResponse.next()
  }

  // Allow requests with a valid auth cookie
  if (hasValidCookie(request)) {
    return NextResponse.next()
  }

  // Check for token in query string — set cookie and redirect
  if (isValidToken(request)) {
    const url = request.nextUrl.clone()
    url.searchParams.delete('token')
    url.pathname = '/'
    const response = NextResponse.redirect(url)
    return createAuthCookie(response)
  }

  // No valid cookie, no valid token — reject
  return new NextResponse('Unauthorized', { status: 401 })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
