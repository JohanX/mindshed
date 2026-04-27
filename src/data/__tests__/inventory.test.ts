import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    inventoryItem: {
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
  findInventoryItemById,
  findActiveInventoryNames,
  findActiveInventoryNamesExcept,
  findInventoryItemsList,
  findInventoryItemOptions,
} from '../inventory'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.inventoryItem.findUnique)
const mockFindMany = vi.mocked(prisma.inventoryItem.findMany)

describe('findInventoryItemById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findInventoryItemById('i1')).toBeNull()
  })
})

describe('findActiveInventoryNames', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns just the names of non-deleted items', async () => {
    mockFindMany.mockResolvedValue([{ name: 'Walnut' }, { name: 'Oak' }] as never)
    expect(await findActiveInventoryNames()).toEqual(['Walnut', 'Oak'])
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isDeleted: false },
      select: { name: true },
    })
  })
})

describe('findActiveInventoryNamesExcept', () => {
  beforeEach(() => vi.clearAllMocks())

  it('excludes the given id', async () => {
    mockFindMany.mockResolvedValue([])
    await findActiveInventoryNamesExcept('exclude-me')
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isDeleted: false, id: { not: 'exclude-me' } },
      select: { name: true },
    })
  })
})

describe('findInventoryItemsList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters out deleted items', async () => {
    mockFindMany.mockResolvedValue([])
    await findInventoryItemsList()
    expect(mockFindMany.mock.calls[0][0].where).toMatchObject({ isDeleted: false })
  })

  it('applies type filter when provided', async () => {
    mockFindMany.mockResolvedValue([])
    await findInventoryItemsList('TOOL')
    expect(mockFindMany.mock.calls[0][0].where).toMatchObject({ type: 'TOOL' })
  })

  it('builds heroThumbnailUrl from UPLOAD storage key', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'i1',
        name: 'Kaolin',
        type: 'MATERIAL',
        quantity: 100,
        unit: 'g',
        notes: null,
        lastMaintenanceDate: null,
        maintenanceIntervalDays: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { blockers: 0 },
        hobbies: [],
        images: [{ id: 'img1', type: 'UPLOAD', storageKey: 'k', url: null }],
      },
    ] as never)
    const result = await findInventoryItemsList()
    expect(result[0].heroImageUrl).toBe('https://r2/k')
    expect(result[0].heroThumbnailUrl).toContain('w=')
  })

  it('returns null hero URLs when item has no images', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'i1',
        name: 'X',
        type: 'TOOL',
        quantity: null,
        unit: null,
        notes: null,
        lastMaintenanceDate: null,
        maintenanceIntervalDays: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { blockers: 0 },
        hobbies: [],
        images: [],
      },
    ] as never)
    const result = await findInventoryItemsList()
    expect(result[0].heroImageUrl).toBeNull()
    expect(result[0].heroThumbnailUrl).toBeNull()
  })
})

describe('findInventoryItemOptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active items ordered by name when no hobby filter', async () => {
    mockFindMany.mockResolvedValue([])
    await findInventoryItemOptions()
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isDeleted: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, quantity: true, unit: true },
    })
  })

  it('scopes to hobby + untagged when hobby filter provided (FR102)', async () => {
    mockFindMany.mockResolvedValue([])
    await findInventoryItemOptions('h1')
    const where = mockFindMany.mock.calls[0][0].where as { OR: unknown[] }
    expect(where.OR).toHaveLength(2)
  })
})
