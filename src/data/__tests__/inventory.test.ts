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
    const args = mockFindMany.mock.calls[0]![0] as { where: unknown }
    expect(args.where).toMatchObject({ isDeleted: false })
  })

  it('applies type filter when provided', async () => {
    mockFindMany.mockResolvedValue([])
    await findInventoryItemsList('TOOL')
    const args = mockFindMany.mock.calls[0]![0] as { where: unknown }
    expect(args.where).toMatchObject({ type: 'TOOL' })
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

  it('returns active items ordered by name when no hobby filter, with hero image select', async () => {
    mockFindMany.mockResolvedValue([])
    await findInventoryItemOptions()
    const call = mockFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>
      orderBy: { name: string }
      select: Record<string, unknown>
    }
    expect(call.where).toEqual({ isDeleted: false })
    expect(call.orderBy).toEqual({ name: 'asc' })
    expect(call.select).toMatchObject({
      id: true,
      name: true,
      type: true,
      quantity: true,
      unit: true,
    })
    // hero image inclusion (Story 29.7 / Issue 1 fix)
    expect(call.select.images).toBeDefined()
  })

  it('scopes to hobby + untagged when hobby filter provided (FR102)', async () => {
    mockFindMany.mockResolvedValue([])
    await findInventoryItemOptions('h1')
    const args = mockFindMany.mock.calls[0]![0] as { where: { OR: unknown[] } }
    expect(args.where.OR).toHaveLength(2)
  })

  it('resolves heroThumbnailUrl from UPLOAD images', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'i1',
        name: 'Kaolin',
        type: 'MATERIAL',
        quantity: 100,
        unit: 'g',
        images: [{ id: 'img1', type: 'UPLOAD', storageKey: 'abc', url: null }],
      },
    ] as never)
    const result = await findInventoryItemOptions()
    expect(result[0].heroThumbnailUrl).toContain('abc')
  })

  it('resolves heroThumbnailUrl from LINK images using the url directly', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'i1',
        name: 'Linked',
        type: 'MATERIAL',
        quantity: null,
        unit: null,
        images: [{ id: 'img1', type: 'LINK', storageKey: null, url: 'https://example.com/p.jpg' }],
      },
    ] as never)
    const result = await findInventoryItemOptions()
    expect(result[0].heroThumbnailUrl).toBe('https://example.com/p.jpg')
  })

  it('returns null heroThumbnailUrl when item has no images', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'i1',
        name: 'NoPhoto',
        type: 'TOOL',
        quantity: null,
        unit: null,
        images: [],
      },
    ] as never)
    const result = await findInventoryItemOptions()
    expect(result[0].heroThumbnailUrl).toBeNull()
  })
})
