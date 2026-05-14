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

import { v2 as cloudinary } from 'cloudinary'
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
    it('calls cloudinary.uploader.destroy with resource_type:image by default', async () => {
      const adapter = createCloudinaryAdapter()
      await expect(adapter.deleteObject('mindshed/steps/abc/img')).resolves.toBeUndefined()
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('mindshed/steps/abc/img', {
        resource_type: 'image',
      })
    })

    it('passes resource_type:image when opts.mediaType is image (Epic 35)', async () => {
      const adapter = createCloudinaryAdapter()
      await adapter.deleteObject('mindshed/steps/abc/img', { mediaType: 'image' })
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('mindshed/steps/abc/img', {
        resource_type: 'image',
      })
    })

    it('passes resource_type:video when opts.mediaType is video (Epic 35, load-bearing)', async () => {
      // Without resource_type:'video', Cloudinary's destroy() silently
      // returns 'not found' and orphans the video bytes — defeats FR122.
      const adapter = createCloudinaryAdapter()
      await adapter.deleteObject('mindshed/steps/abc/vid', { mediaType: 'video' })
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('mindshed/steps/abc/vid', {
        resource_type: 'video',
      })
    })
  })

  describe('upload', () => {
    it('passes resource_type:video when opts.mediaType is video (Epic 35)', async () => {
      const adapter = createCloudinaryAdapter()
      await adapter.upload(Buffer.from('fake-video-data'), 'steps/abc/vid.mp4', 'video/mp4', {
        mediaType: 'video',
      })
      const call = vi.mocked(cloudinary.uploader.upload).mock.calls.at(-1)
      expect(call?.[1]).toMatchObject({ resource_type: 'video', format: 'mp4' })
    })

    it('passes resource_type:image when opts are omitted (back-compat)', async () => {
      const adapter = createCloudinaryAdapter()
      await adapter.upload(Buffer.from('fake'), 'steps/abc/img.jpg', 'image/jpeg')
      const call = vi.mocked(cloudinary.uploader.upload).mock.calls.at(-1)
      expect(call?.[1]).toMatchObject({ resource_type: 'image' })
    })
  })

  describe('getVideoUrl (Epic 35)', () => {
    it('returns /video/upload/<key> URL', () => {
      const adapter = createCloudinaryAdapter()
      const url = adapter.getVideoUrl('mindshed/steps/abc/vid')
      expect(url).toBe('https://res.cloudinary.com/demo/video/upload/mindshed/steps/abc/vid')
    })

    it('throws when CLOUDINARY_CLOUD_NAME is missing', () => {
      const adapter = createCloudinaryAdapter()
      delete process.env.CLOUDINARY_CLOUD_NAME
      expect(() => adapter.getVideoUrl('key')).toThrow('Missing CLOUDINARY_CLOUD_NAME')
    })
  })

  describe('getVideoPosterUrl (Epic 35)', () => {
    it('returns so_auto + w_<width> + f_jpg URL', () => {
      const adapter = createCloudinaryAdapter()
      const url = adapter.getVideoPosterUrl('mindshed/steps/abc/vid', 800)
      expect(url).toBe(
        'https://res.cloudinary.com/demo/video/upload/so_auto,w_800,f_jpg/mindshed/steps/abc/vid.jpg',
      )
    })

    it('handles different widths', () => {
      const adapter = createCloudinaryAdapter()
      expect(adapter.getVideoPosterUrl('vid', 160)).toContain('w_160')
      expect(adapter.getVideoPosterUrl('vid', 1200)).toContain('w_1200')
    })

    it('throws when CLOUDINARY_CLOUD_NAME is missing', () => {
      const adapter = createCloudinaryAdapter()
      delete process.env.CLOUDINARY_CLOUD_NAME
      expect(() => adapter.getVideoPosterUrl('key', 64)).toThrow('Missing CLOUDINARY_CLOUD_NAME')
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
