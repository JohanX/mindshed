import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  isAuthEnabled: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(() => ({
    getPublicUrl: vi.fn(),
    deleteObject: vi.fn(),
    generatePresignedUrl: vi.fn().mockResolvedValue({
      url: 'https://storage.example.com/presigned-url',
      key: 'steps/550e8400-e29b-41d4-a716-446655440000/test-uuid.jpg',
    }),
    upload: vi.fn(),
  })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'authenticated' }),
  }),
}))

import { POST } from '../presign/route'
import { isAuthEnabled } from '@/lib/auth'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'

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
    process.env.IMAGE_PROVIDER = 's3'
  })

  it('returns presigned URL and key for valid request', async () => {
    const req = makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://storage.example.com/presigned-url')
    expect(body.key).toBeDefined()
  })

  it('rejects invalid content type', async () => {
    const req = makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'file.gif',
      contentType: 'image/gif',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects missing stepId', async () => {
    const req = makeRequest({
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects invalid stepId', async () => {
    const req = makeRequest({
      stepId: 'not-a-uuid',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('generates correct key format steps/{stepId}/{uuid}.{ext}', async () => {
    const mockAdapter = vi.mocked(getImageStorageAdapter)
    const mockPresign = vi.fn().mockResolvedValue({ url: 'https://test.com', key: 'test' })
    mockAdapter.mockReturnValue({
      getPublicUrl: vi.fn(),
      deleteObject: vi.fn(),
      generatePresignedUrl: mockPresign,
      upload: vi.fn(),
    })

    const req = makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    await POST(req)
    const calledKey = mockPresign.mock.calls[0][0] as string
    expect(calledKey).toMatch(/^steps\/550e8400-e29b-41d4-a716-446655440000\/[a-f0-9-]+\.jpg$/)
  })

  it('accepts webp content type', async () => {
    const req = makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'photo.webp',
      contentType: 'image/webp',
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.key).toBeDefined()
  })

  it('returns 404 when adapter does not support presigned URLs', async () => {
    const mockAdapter = vi.mocked(getImageStorageAdapter)
    mockAdapter.mockReturnValue({
      getPublicUrl: vi.fn(),
      deleteObject: vi.fn(),
      generatePresignedUrl: vi.fn().mockRejectedValue(new Error('does not support presigned URLs')),
      upload: vi.fn(),
    })

    const req = makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('returns 501 when IMAGE_PROVIDER is not set and adapter is null', async () => {
    delete process.env.IMAGE_PROVIDER
    vi.mocked(getImageStorageAdapter).mockReturnValue(null)

    const req = makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const res = await POST(req)
    expect(res.status).toBe(501)
  })

  it('rejects unauthenticated requests when auth is enabled', async () => {
    vi.mocked(isAuthEnabled).mockReturnValue(true)
    vi.mock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      }),
    }))

    const req = makeRequest({
      stepId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
