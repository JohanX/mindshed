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
      await expect(
        adapter.generatePresignedUrl('key', 'image/jpeg'),
      ).rejects.toThrow('does not support presigned URLs')
    })
  })
})
