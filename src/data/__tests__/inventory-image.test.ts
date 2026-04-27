import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    inventoryItemImage: {
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

import {
  findInventoryItemImageById,
  findInventoryItemImagesWithDisplayUrl,
} from '../inventory-image'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.inventoryItemImage.findUnique)
const mockFindMany = vi.mocked(prisma.inventoryItemImage.findMany)

describe('findInventoryItemImageById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findInventoryItemImageById('img1')).toBeNull()
  })

  it('selects id, inventoryItemId, type, storageKey', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'img1',
      inventoryItemId: 'inv1',
      type: 'UPLOAD',
      storageKey: 'k',
    } as never)
    await findInventoryItemImageById('img1')
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'img1' },
      select: { id: true, inventoryItemId: true, type: true, storageKey: true },
    })
  })
})

describe('findInventoryItemImagesWithDisplayUrl', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when no images', async () => {
    mockFindMany.mockResolvedValue([])
    expect(await findInventoryItemImagesWithDisplayUrl('inv1')).toEqual([])
  })

  it('orders by createdAt asc', async () => {
    mockFindMany.mockResolvedValue([])
    await findInventoryItemImagesWithDisplayUrl('inv1')
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { inventoryItemId: 'inv1' },
      orderBy: { createdAt: 'asc' },
    })
  })

  it('builds displayUrl + thumbnailUrl for UPLOAD images', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'img1',
        inventoryItemId: 'inv1',
        type: 'UPLOAD',
        storageKey: 'k',
        url: null,
        originalFilename: 'f.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1,
        createdAt: new Date(),
      },
    ] as never)
    const result = await findInventoryItemImagesWithDisplayUrl('inv1')
    expect(result[0].displayUrl).toBe('https://r2/k')
    expect(result[0].thumbnailUrl).toContain('w=')
  })

  it('uses url for LINK images', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'img2',
        inventoryItemId: 'inv1',
        type: 'LINK',
        storageKey: null,
        url: 'https://example.com/p.jpg',
        originalFilename: null,
        contentType: null,
        sizeBytes: null,
        createdAt: new Date(),
      },
    ] as never)
    const result = await findInventoryItemImagesWithDisplayUrl('inv1')
    expect(result[0].displayUrl).toBe('https://example.com/p.jpg')
    expect(result[0].thumbnailUrl).toBe('https://example.com/p.jpg')
  })
})
