import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      upload: vi.fn().mockResolvedValue({
        public_id: 'mindshed/steps/abc/img',
        secure_url: 'https://res.cloudinary.com/demo/image/upload/mindshed/steps/abc/img.jpg',
      }),
      destroy: vi.fn().mockResolvedValue({ result: 'ok' }),
    },
  },
}))

import { createCloudinaryAdapter } from '../cloudinary'

describe('CloudinaryStorageAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLOUDINARY_CLOUD_NAME = 'demo'
    process.env.CLOUDINARY_API_KEY = 'test-key'
    process.env.CLOUDINARY_API_SECRET = 'test-secret'
  })

  describe('getPublicUrl', () => {
    it('returns Cloudinary secure_url format', () => {
      const adapter = createCloudinaryAdapter()
      const url = adapter.getPublicUrl('mindshed/steps/abc/img')
      expect(url).toBe('https://res.cloudinary.com/demo/image/upload/mindshed/steps/abc/img')
    })
  })

  describe('getThumbnailUrl', () => {
    it('injects f_auto,q_auto,w_<width> transforms into the URL', () => {
      const adapter = createCloudinaryAdapter()
      const url = adapter.getThumbnailUrl('mindshed/steps/abc/img', 64)
      expect(url).toBe(
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_64/mindshed/steps/abc/img',
      )
    })

    it('handles different widths correctly', () => {
      const adapter = createCloudinaryAdapter()
      expect(adapter.getThumbnailUrl('mindshed/abc', 80)).toContain('w_80')
      expect(adapter.getThumbnailUrl('mindshed/abc', 400)).toContain('w_400')
    })

    it('does not affect getPublicUrl output', () => {
      const adapter = createCloudinaryAdapter()
      adapter.getThumbnailUrl('mindshed/abc', 64)
      expect(adapter.getPublicUrl('mindshed/abc')).toBe(
        'https://res.cloudinary.com/demo/image/upload/mindshed/abc',
      )
    })

    it('throws when CLOUDINARY_CLOUD_NAME is missing', () => {
      const adapter = createCloudinaryAdapter()
      delete process.env.CLOUDINARY_CLOUD_NAME
      expect(() => adapter.getThumbnailUrl('key', 64)).toThrow('Missing CLOUDINARY_CLOUD_NAME')
    })
  })

  describe('upload', () => {
    it('uploads via Cloudinary SDK and returns publicUrl and storageKey', async () => {
      const adapter = createCloudinaryAdapter()
      const result = await adapter.upload(
        Buffer.from('fake-image-data'),
        'steps/abc/img.jpg',
        'image/jpeg',
      )
      expect(result.publicUrl).toBe(
        'https://res.cloudinary.com/demo/image/upload/mindshed/steps/abc/img.jpg',
      )
      expect(result.storageKey).toBe('mindshed/steps/abc/img')
    })
  })

  describe('deleteObject', () => {
    it('calls cloudinary.uploader.destroy', async () => {
      const adapter = createCloudinaryAdapter()
      await expect(adapter.deleteObject('mindshed/steps/abc/img')).resolves.toBeUndefined()
    })
  })

  describe('generatePresignedUrl', () => {
    it('throws — Cloudinary does not use presigned URLs', async () => {
      const adapter = createCloudinaryAdapter()
      await expect(adapter.generatePresignedUrl('key', 'image/jpeg')).rejects.toThrow(
        'does not support presigned URLs',
      )
    })
  })
})
