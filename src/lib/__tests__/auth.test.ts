import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { isAuthEnabled, isValidToken, hasValidCookie } from '../auth'

describe('isAuthEnabled', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when APP_SECRET is not set', () => {
    vi.stubEnv('APP_SECRET', '')
    expect(isAuthEnabled()).toBe(false)
  })

  it('returns true when APP_SECRET is set', () => {
    vi.stubEnv('APP_SECRET', 'test-secret')
    expect(isAuthEnabled()).toBe(true)
  })

  it('returns false when APP_SECRET is empty string', () => {
    vi.stubEnv('APP_SECRET', '')
    expect(isAuthEnabled()).toBe(false)
  })
})

describe('isValidToken', () => {
  beforeEach(() => {
    vi.stubEnv('APP_SECRET', 'test-secret')
  })

  it('returns true when token matches secret', () => {
    const request = new NextRequest('http://localhost:3000/?token=test-secret')
    expect(isValidToken(request)).toBe(true)
  })

  it('returns false when token does not match', () => {
    const request = new NextRequest('http://localhost:3000/?token=wrong-secret')
    expect(isValidToken(request)).toBe(false)
  })

  it('returns false when no token is provided', () => {
    const request = new NextRequest('http://localhost:3000/')
    expect(isValidToken(request)).toBe(false)
  })
})

describe('hasValidCookie', () => {
  it('returns true when cookie is present and correct', () => {
    const request = new NextRequest('http://localhost:3000/', {
      headers: { cookie: 'mindshed_auth=authenticated' },
    })
    expect(hasValidCookie(request)).toBe(true)
  })

  it('returns false when cookie is missing', () => {
    const request = new NextRequest('http://localhost:3000/')
    expect(hasValidCookie(request)).toBe(false)
  })

  it('returns false when cookie has wrong value', () => {
    const request = new NextRequest('http://localhost:3000/', {
      headers: { cookie: 'mindshed_auth=wrong' },
    })
    expect(hasValidCookie(request)).toBe(false)
  })
})
