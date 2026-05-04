import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  isAuthEnabled: vi.fn(),
  hasValidCookie: vi.fn(),
  isValidToken: vi.fn(),
  createAuthCookie: vi.fn(),
}))

import { proxy, config } from '../proxy'
import { isAuthEnabled, hasValidCookie } from '@/lib/auth'

const mockIsAuthEnabled = vi.mocked(isAuthEnabled)
const mockHasValidCookie = vi.mocked(hasValidCookie)

describe('proxy — gallery auth bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthEnabled.mockReturnValue(true)
    mockHasValidCookie.mockReturnValue(false)
  })

  it('/gallery bypasses auth', () => {
    const request = new NextRequest('http://localhost:3000/gallery')
    const response = proxy(request)
    expect(response.status).not.toBe(401)
  })

  it('/gallery/walnut-side-table bypasses auth', () => {
    const request = new NextRequest('http://localhost:3000/gallery/walnut-side-table')
    const response = proxy(request)
    expect(response.status).not.toBe(401)
  })

  it('/gallery/walnut-side-table/result bypasses auth', () => {
    const request = new NextRequest('http://localhost:3000/gallery/walnut-side-table/result')
    const response = proxy(request)
    expect(response.status).not.toBe(401)
  })

  it('/ still requires auth', () => {
    const request = new NextRequest('http://localhost:3000/')
    const response = proxy(request)
    expect(response.status).toBe(401)
  })

  it('/hobbies still requires auth', () => {
    const request = new NextRequest('http://localhost:3000/hobbies')
    const response = proxy(request)
    expect(response.status).toBe(401)
  })

  it('/settings still requires auth', () => {
    const request = new NextRequest('http://localhost:3000/settings')
    const response = proxy(request)
    expect(response.status).toBe(401)
  })
})

describe('proxy matcher — exclusion list shape', () => {
  // Compiles the matcher pattern as a regex. This approximates Next's
  // middleware-matcher compilation enough to catch prefix-collision regressions
  // (e.g., a bare `icon` alternative matching `/iconography`).
  const re = new RegExp(`^${config.matcher[0]}$`)

  const excludedPaths = [
    '/icon',
    '/apple-icon',
    '/favicon.ico',
    '/_next/static/chunks/foo.js',
    '/api/upload/presign',
    '/foo.png',
    '/something.svg',
  ]
  for (const path of excludedPaths) {
    it(`${path} is excluded from proxy (matcher does NOT match)`, () => {
      expect(re.test(path)).toBe(false)
    })
  }

  const includedPaths = [
    '/',
    '/hobbies',
    '/settings',
    '/iconography', // prefix-collision guard — must NOT be excluded
    '/icons', // prefix-collision guard
    '/apple-icon-test', // prefix-collision guard
    '/icon/sub', // sub-paths of /icon must still be auth-gated
  ]
  for (const path of includedPaths) {
    it(`${path} is included by proxy (matcher DOES match)`, () => {
      expect(re.test(path)).toBe(true)
    })
  }
})
