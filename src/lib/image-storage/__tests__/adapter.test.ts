import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must mock child modules before importing adapter
vi.mock('../s3', () => ({
  createS3Adapter: vi.fn(() => ({
    getPublicUrl: vi.fn(),
    getThumbnailUrl: vi.fn(),
    deleteObject: vi.fn(),
    generatePresignedUrl: vi.fn(),
    upload: vi.fn(),
  })),
}))

vi.mock('../cloudinary', () => ({
  createCloudinaryAdapter: vi.fn(() => ({
    getPublicUrl: vi.fn(),
    getThumbnailUrl: vi.fn(),
    deleteObject: vi.fn(),
    generatePresignedUrl: vi.fn(),
    upload: vi.fn(),
  })),
}))

import { getImageStorageAdapter, _resetAdapter } from '../adapter'
import { createS3Adapter } from '../s3'
import { createCloudinaryAdapter } from '../cloudinary'

describe('getImageStorageAdapter', () => {
  beforeEach(() => {
    _resetAdapter()
    vi.clearAllMocks()
    delete process.env.IMAGE_PROVIDER
  })

  it('returns S3 adapter when IMAGE_PROVIDER=s3', () => {
    process.env.IMAGE_PROVIDER = 's3'
    const adapter = getImageStorageAdapter()
    expect(adapter).not.toBeNull()
    expect(createS3Adapter).toHaveBeenCalled()
    expect(createCloudinaryAdapter).not.toHaveBeenCalled()
  })

  it('returns Cloudinary adapter when IMAGE_PROVIDER=cloudinary', () => {
    process.env.IMAGE_PROVIDER = 'cloudinary'
    const adapter = getImageStorageAdapter()
    expect(adapter).not.toBeNull()
    expect(createCloudinaryAdapter).toHaveBeenCalled()
    expect(createS3Adapter).not.toHaveBeenCalled()
  })

  it('returns null with console.warn when IMAGE_PROVIDER is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const adapter = getImageStorageAdapter()
    expect(adapter).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('IMAGE_PROVIDER is not set'),
    )
    warnSpy.mockRestore()
  })

  it('returns null with console.warn when IMAGE_PROVIDER is invalid', () => {
    process.env.IMAGE_PROVIDER = 'dropbox'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const adapter = getImageStorageAdapter()
    expect(adapter).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"dropbox" is not a valid option'),
    )
    warnSpy.mockRestore()
  })

  it('caches the adapter on subsequent calls', () => {
    process.env.IMAGE_PROVIDER = 's3'
    const first = getImageStorageAdapter()
    const second = getImageStorageAdapter()
    expect(first).toBe(second)
    expect(createS3Adapter).toHaveBeenCalledTimes(1)
  })

  it('resets cache with _resetAdapter', () => {
    process.env.IMAGE_PROVIDER = 's3'
    getImageStorageAdapter()
    _resetAdapter()
    process.env.IMAGE_PROVIDER = 'cloudinary'
    getImageStorageAdapter()
    expect(createS3Adapter).toHaveBeenCalledTimes(1)
    expect(createCloudinaryAdapter).toHaveBeenCalledTimes(1)
  })
})
