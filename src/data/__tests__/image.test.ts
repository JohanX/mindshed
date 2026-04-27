import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    stepImage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(() => ({
    getPublicUrl: vi.fn((key: string) => `https://r2/${key}`),
    getThumbnailUrl: vi.fn((key: string, w: number) => `https://r2/${key}?w=${w}`),
  })),
}))

import { findStepImageWithContext, findStepImagesWithDisplayUrl } from '../image'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.stepImage.findUnique)
const mockFindMany = vi.mocked(prisma.stepImage.findMany)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('findStepImageWithContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns image with step + project context shape', async () => {
    mockFindUnique.mockResolvedValue({
      id: VALID_UUID,
      type: 'UPLOAD',
      storageKey: 'k',
      step: { projectId: 'p1', project: { hobbyId: 'h1' } },
    } as never)
    const result = await findStepImageWithContext(VALID_UUID)
    expect(result).toMatchObject({
      id: VALID_UUID,
      step: { projectId: 'p1', project: { hobbyId: 'h1' } },
    })
  })

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findStepImageWithContext(VALID_UUID)).toBeNull()
  })
})

describe('findStepImagesWithDisplayUrl', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when no images', async () => {
    mockFindMany.mockResolvedValue([])
    expect(await findStepImagesWithDisplayUrl('s1')).toEqual([])
  })

  it('builds displayUrl + thumbnailUrl for UPLOAD images', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'img1',
        stepId: 's1',
        type: 'UPLOAD',
        storageKey: 'steps/s1/abc.jpg',
        url: null,
        originalFilename: 'abc.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1234,
        createdAt: new Date('2026-01-01'),
      },
    ] as never)
    const result = await findStepImagesWithDisplayUrl('s1')
    expect(result[0].displayUrl).toBe('https://r2/steps/s1/abc.jpg')
    expect(result[0].thumbnailUrl).toContain('w=')
  })

  it('uses url field for LINK images', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'img2',
        stepId: 's1',
        type: 'LINK',
        storageKey: null,
        url: 'https://example.com/photo.jpg',
        originalFilename: null,
        contentType: null,
        sizeBytes: null,
        createdAt: new Date('2026-01-01'),
      },
    ] as never)
    const result = await findStepImagesWithDisplayUrl('s1')
    expect(result[0].displayUrl).toBe('https://example.com/photo.jpg')
    expect(result[0].thumbnailUrl).toBe('https://example.com/photo.jpg')
  })

  it('orders by createdAt desc', async () => {
    mockFindMany.mockResolvedValue([])
    await findStepImagesWithDisplayUrl('s1')
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { stepId: 's1' },
      orderBy: { createdAt: 'desc' },
    })
  })
})
