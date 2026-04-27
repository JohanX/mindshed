import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    bomItem: {
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
  findBomItemById,
  findBomItemsByProject,
  findDistinctProjectsForInventoryItem,
} from '../bom'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.bomItem.findUnique)
const mockFindMany = vi.mocked(prisma.bomItem.findMany)

describe('findBomItemById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findBomItemById('b1')).toBeNull()
  })
})

describe('findBomItemsByProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('orders by sortOrder asc', async () => {
    mockFindMany.mockResolvedValue([])
    await findBomItemsByProject('p1')
    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual({ sortOrder: 'asc' })
  })

  it('returns empty array when no rows', async () => {
    mockFindMany.mockResolvedValue([])
    expect(await findBomItemsByProject('p1')).toEqual([])
  })

  it('builds heroThumbnailUrl from UPLOAD storage key', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'b1',
        label: null,
        requiredQuantity: 100,
        unit: 'g',
        sortOrder: 0,
        consumptionState: 'NOT_CONSUMED',
        inventoryItem: {
          id: 'inv1',
          name: 'Kaolin',
          type: 'MATERIAL',
          quantity: 500,
          isDeleted: false,
          images: [{ id: 'img1', type: 'UPLOAD', storageKey: 'k', url: null }],
        },
      },
    ] as never)
    const result = await findBomItemsByProject('p1')
    expect(result[0].inventoryItem?.heroThumbnailUrl).toContain('w=')
  })

  it('returns null heroThumbnailUrl when inventoryItem has no images', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'b1',
        label: 'free-form',
        requiredQuantity: 100,
        unit: null,
        sortOrder: 0,
        consumptionState: 'NOT_CONSUMED',
        inventoryItem: null,
      },
    ] as never)
    const result = await findBomItemsByProject('p1')
    expect(result[0].inventoryItem).toBeNull()
  })
})

describe('findDistinctProjectsForInventoryItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flattens nested project shape', async () => {
    mockFindMany.mockResolvedValue([
      { project: { id: 'p1', hobbyId: 'h1' } },
      { project: { id: 'p2', hobbyId: 'h2' } },
    ] as never)
    const result = await findDistinctProjectsForInventoryItem('inv1')
    expect(result).toEqual([
      { id: 'p1', hobbyId: 'h1' },
      { id: 'p2', hobbyId: 'h2' },
    ])
  })

  it('uses distinct on projectId', async () => {
    mockFindMany.mockResolvedValue([])
    await findDistinctProjectsForInventoryItem('inv1')
    expect(mockFindMany.mock.calls[0][0]).toMatchObject({
      where: { inventoryItemId: 'inv1' },
      distinct: ['projectId'],
    })
  })
})
