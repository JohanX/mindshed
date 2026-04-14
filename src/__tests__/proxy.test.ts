import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/auth', () => ({
  isAuthEnabled: vi.fn(),
  hasValidCookie: vi.fn(),
  isValidToken: vi.fn(),
  createAuthCookie: vi.fn(),
}))

import { proxy } from '../proxy'
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
