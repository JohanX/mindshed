import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn().mockResolvedValue({})
  return {
    S3Client: class MockS3Client {
      send = mockSend
      constructor() {
        /* noop */
      }
    },
    DeleteObjectCommand: class MockDeleteCmd {
      constructor(public input: unknown) {}
    },
    PutObjectCommand: class MockPutCmd {
      constructor(public input: unknown) {}
    },
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://presigned.example.com/test'),
}))

import { createS3Adapter } from '../s3'

describe('S3StorageAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.R2_ENDPOINT = 'http://localhost:9000'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'
    delete process.env.R2_PUBLIC_URL
  })

  describe('getPublicUrl', () => {
    it('uses R2_PUBLIC_URL when set', () => {
      process.env.R2_PUBLIC_URL = 'https://cdn.example.com'
      const adapter = createS3Adapter()
      const url = adapter.getPublicUrl('steps/abc/img.jpg')
      expect(url).toBe('https://cdn.example.com/test-bucket/steps/abc/img.jpg')
    })

    it('falls back to R2_ENDPOINT/bucket when R2_PUBLIC_URL not set', () => {
      const adapter = createS3Adapter()
      const url = adapter.getPublicUrl('steps/abc/img.jpg')
      expect(url).toBe('http://localhost:9000/test-bucket/steps/abc/img.jpg')
    })

    it('throws when R2_ENDPOINT and R2_PUBLIC_URL are both missing', () => {
      delete process.env.R2_ENDPOINT
      delete process.env.R2_PUBLIC_URL
      delete process.env.R2_BUCKET_NAME
      const adapter = createS3Adapter()
      expect(() => adapter.getPublicUrl('key')).toThrow('Missing')
    })
  })

  describe('getThumbnailUrl', () => {
    it('returns same URL as getPublicUrl (no transforms for S3)', () => {
      const adapter = createS3Adapter()
      const storageKey = 'steps/abc/img.jpg'
      expect(adapter.getThumbnailUrl(storageKey, 64)).toBe(adapter.getPublicUrl(storageKey))
    })

    it('ignores width parameter — S3 has no URL-based transforms', () => {
      const adapter = createS3Adapter()
      const key = 'steps/abc/img.jpg'
      expect(adapter.getThumbnailUrl(key, 64)).toBe(adapter.getThumbnailUrl(key, 400))
    })

    it('uses R2_PUBLIC_URL when set', () => {
      process.env.R2_PUBLIC_URL = 'https://cdn.example.com'
      const adapter = createS3Adapter()
      expect(adapter.getThumbnailUrl('key.jpg', 80)).toBe(
        'https://cdn.example.com/test-bucket/key.jpg',
      )
    })
  })

  describe('generatePresignedUrl', () => {
    it('returns presigned URL and key', async () => {
      const adapter = createS3Adapter()
      const result = await adapter.generatePresignedUrl('steps/abc/img.jpg', 'image/jpeg')
      expect(result.url).toBe('https://presigned.example.com/test')
      expect(result.key).toBe('steps/abc/img.jpg')
    })
  })

  describe('deleteObject', () => {
    it('calls S3 DeleteObjectCommand', async () => {
      const adapter = createS3Adapter()
      await expect(adapter.deleteObject('steps/abc/img.jpg')).resolves.toBeUndefined()
    })
  })

  describe('upload', () => {
    it('throws — S3 uses presigned URLs, not server-side upload', async () => {
      const adapter = createS3Adapter()
      await expect(adapter.upload(Buffer.from('test'), 'key', 'image/jpeg')).rejects.toThrow(
        'does not support server-side upload',
      )
    })
  })
})
