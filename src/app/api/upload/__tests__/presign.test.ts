import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  isAuthEnabled: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/r2', () => ({
  getR2Client: vi.fn().mockReturnValue({}),
  getR2Bucket: vi.fn().mockReturnValue('test-bucket'),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: vi.fn(),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://storage.example.com/presigned-url'),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'authenticated' }),
  }),
}))

import { POST } from '../presign/route'
import { isAuthEnabled } from '@/lib/auth'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/upload/presign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isAuthEnabled).mockReturnValue(false)
  })

  it('returns presigned URL and key for valid request', async () => {
    const res = await POST(makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://storage.example.com/presigned-url')
    expect(body.key).toMatch(/^steps\/550e8400.*\.jpg$/)
    expect(getSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid content type', async () => {
    const res = await POST(makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'doc.pdf',
      contentType: 'application/pdf',
    }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('rejects missing stepId', async () => {
    const res = await POST(makeRequest({
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    }))

    expect(res.status).toBe(400)
  })

  it('rejects invalid stepId', async () => {
    const res = await POST(makeRequest({
      stepId: 'not-a-uuid',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    }))

    expect(res.status).toBe(400)
  })

  it('returns 401 when auth enabled and no cookie', async () => {
    vi.mocked(isAuthEnabled).mockReturnValue(true)

    const { cookies } = await import('next/headers')
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never)

    const res = await POST(makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    }))

    expect(res.status).toBe(401)
  })

  it('generates correct key format steps/{stepId}/{uuid}.{ext}', async () => {
    const res = await POST(makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'image.png',
      contentType: 'image/png',
    }))

    const body = await res.json()
    expect(body.key).toMatch(/^steps\/550e8400-e29b-41d4-a716-446655440000\/[a-f0-9-]+\.png$/)
  })

  it('accepts webp content type', async () => {
    const res = await POST(makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'image.webp',
      contentType: 'image/webp',
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.key).toMatch(/\.webp$/)
  })
})
