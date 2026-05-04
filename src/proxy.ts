import { NextRequest, NextResponse } from 'next/server'
import { isAuthEnabled, hasValidCookie, isValidToken, createAuthCookie } from '@/lib/auth'

export function proxy(request: NextRequest) {
  // Skip auth if APP_SECRET is not configured (local dev)
  if (!isAuthEnabled()) {
    return NextResponse.next()
  }

  // Gallery routes are public — no auth required
  if (request.nextUrl.pathname.startsWith('/gallery')) {
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
    // Preserve original path — don't force redirect to /
    const response = NextResponse.redirect(url)
    return createAuthCookie(response)
  }

  // No valid cookie, no valid token — reject
  return new NextResponse('Unauthorized', { status: 401 })
}

// `icon$` and `apple-icon$` are anchored — the metadata routes live at
// exactly /icon and /apple-icon. Bare `icon`/`apple-icon` would match any
// path starting with those substrings (e.g., a future `/iconography` page),
// silently bypassing auth. Anchoring keeps the bypass tight to the
// programmatic icon route handlers from `app/icon.tsx` and `app/apple-icon.tsx`.
// `favicon.ico` is left unanchored to match the pre-existing convention.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon$|apple-icon$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
