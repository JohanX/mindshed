import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'mindshed_auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export function getAppSecret(): string | undefined {
  return process.env.APP_SECRET
}

export function isAuthEnabled(): boolean {
  const secret = getAppSecret()
  return typeof secret === 'string' && secret.length > 0
}

export function createAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return response
}

export function hasValidCookie(request: NextRequest): boolean {
  const cookie = request.cookies.get(COOKIE_NAME)
  return cookie?.value === 'authenticated'
}

export function isValidToken(request: NextRequest): boolean {
  const secret = getAppSecret()
  if (!secret) return false
  const token = request.nextUrl.searchParams.get('token')
  if (!token || token.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret))
}
