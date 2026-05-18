import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  isAuthEnabled: vi.fn().mockReturnValue(false),
}))

const mockCookieGet = vi.fn().mockReturnValue({ value: 'authenticated' })
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mockCookieGet })),
}))

import { POST, buildCloudinarySignature } from '../cloudinary-sign/route'
import { isAuthEnabled } from '@/lib/auth'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/upload/cloudinary-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('buildCloudinarySignature (Story 35.5 / FR138)', () => {
  // Story 35.5 — signature-determinism snapshot. If a future caller
  // adds or removes a signed param, this assertion drifts and the
  // upload starts returning 401 from Cloudinary. The snapshot locks
  // the current contract (`folder` + `timestamp` only).
  it('returns the SHA-1 of sorted query string + api_secret', () => {
    const sig = buildCloudinarySignature({
      folder: 'steps/abc-123',
      timestamp: 1700000000,
      apiSecret: 'fake-secret',
    })
    // Computed offline against the Cloudinary spec:
    //   canonical = "folder=steps/abc-123&timestamp=1700000000"
    //   signature = sha1(canonical + "fake-secret")
    expect(sig).toBe('cb425e4f6016a8a527773081aa0f4372f768e896')
  })

  it('changes when folder changes (no salting collisions)', () => {
    const a = buildCloudinarySignature({
      folder: 'steps/abc',
      timestamp: 1700000000,
      apiSecret: 'fake-secret',
    })
    const b = buildCloudinarySignature({
      folder: 'steps/xyz',
      timestamp: 1700000000,
      apiSecret: 'fake-secret',
    })
    expect(a).not.toBe(b)
  })

  it('changes when timestamp changes', () => {
    const a = buildCloudinarySignature({
      folder: 'steps/abc',
      timestamp: 1700000000,
      apiSecret: 'fake-secret',
    })
    const b = buildCloudinarySignature({
      folder: 'steps/abc',
      timestamp: 1700000001,
      apiSecret: 'fake-secret',
    })
    expect(a).not.toBe(b)
  })
})

describe('POST /api/upload/cloudinary-sign (Story 35.5 / FR138)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookieGet.mockReturnValue({ value: 'authenticated' })
    vi.mocked(isAuthEnabled).mockReturnValue(false)
    process.env.CLOUDINARY_CLOUD_NAME = 'fake-cloud'
    process.env.CLOUDINARY_API_KEY = 'fake-key'
    process.env.CLOUDINARY_API_SECRET = 'fake-secret'
  })

  it('returns signature payload for a valid request', async () => {
    const req = makeRequest({
      folder: 'steps/550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'video',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      apiKey: 'fake-key',
      cloudName: 'fake-cloud',
      folder: 'steps/550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'video',
    })
    expect(typeof body.timestamp).toBe('number')
    expect(typeof body.signature).toBe('string')
    expect(body.signature).toMatch(/^[a-f0-9]{40}$/) // SHA-1 hex
  })

  it('rejects request with malformed folder (path injection guard)', async () => {
    const req = makeRequest({
      folder: '../../../etc/passwd',
      resourceType: 'video',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects request with disallowed prefix (only steps/ permitted in V1)', async () => {
    const req = makeRequest({
      folder: 'ideas/abc-123',
      resourceType: 'video',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects request with invalid resourceType', async () => {
    const req = makeRequest({
      folder: 'steps/550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'raw',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 when auth is enabled and cookie is missing', async () => {
    vi.mocked(isAuthEnabled).mockReturnValue(true)
    mockCookieGet.mockReturnValue(undefined)
    const req = makeRequest({
      folder: 'steps/550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'video',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when auth is enabled and cookie value is invalid', async () => {
    vi.mocked(isAuthEnabled).mockReturnValue(true)
    mockCookieGet.mockReturnValue({ value: 'nope' })
    const req = makeRequest({
      folder: 'steps/550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'video',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 501 when Cloudinary env vars are missing', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME
    delete process.env.CLOUDINARY_API_KEY
    delete process.env.CLOUDINARY_API_SECRET
    const req = makeRequest({
      folder: 'steps/550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'video',
    })
    const res = await POST(req)
    expect(res.status).toBe(501)
  })

  it('returns signature payload for image resourceType too', async () => {
    // V1 dispatch keeps IMAGE on the Server Action path, but the
    // sign-upload endpoint accepts `image` for forward-compatibility
    // (a future story may unify both paths via direct upload).
    const req = makeRequest({
      folder: 'steps/550e8400-e29b-41d4-a716-446655440000',
      resourceType: 'image',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resourceType).toBe('image')
  })
})
