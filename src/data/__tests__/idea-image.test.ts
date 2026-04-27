import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    ideaImage: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(() => ({
    getPublicUrl: vi.fn((key: string) => `https://r2/${key}`),
    getThumbnailUrl: vi.fn((key: string, w: number) => `https://r2/${key}?w=${w}`),
  })),
}))

import { findIdeaImage, findIdeaImageWithDisplayUrl } from '../idea-image'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.ideaImage.findUnique)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('findIdeaImage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no photo for the idea', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findIdeaImage(VALID_UUID)).toBeNull()
  })
})

describe('findIdeaImageWithDisplayUrl', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no photo', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findIdeaImageWithDisplayUrl(VALID_UUID)).toBeNull()
  })

  it('builds displayUrl + thumbnailUrl for UPLOAD images', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'img1',
      ideaId: VALID_UUID,
      type: 'UPLOAD',
      storageKey: 'ideas/abc/def.jpg',
      url: null,
      originalFilename: 'abc.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1234,
      createdAt: new Date('2026-01-01'),
    } as never)
    const result = await findIdeaImageWithDisplayUrl(VALID_UUID)
    expect(result?.displayUrl).toBe('https://r2/ideas/abc/def.jpg')
    expect(result?.thumbnailUrl).toContain('w=')
  })

  it('uses the stored url for LINK images', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'img1',
      ideaId: VALID_UUID,
      type: 'LINK',
      storageKey: null,
      url: 'https://example.com/photo.jpg',
      originalFilename: null,
      contentType: null,
      sizeBytes: null,
      createdAt: new Date('2026-01-01'),
    } as never)
    const result = await findIdeaImageWithDisplayUrl(VALID_UUID)
    expect(result?.displayUrl).toBe('https://example.com/photo.jpg')
    expect(result?.thumbnailUrl).toBe('https://example.com/photo.jpg')
  })
})
