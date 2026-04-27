import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    idea: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(() => ({
    getThumbnailUrl: vi.fn((key: string, w: number) => `https://r2/${key}?w=${w}`),
  })),
}))

import {
  findIdeaById,
  findIdeaForPromotion,
  findIdeasByHobby,
  findAllIdeas,
  deriveIdeaThumbnail,
} from '../idea'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.idea.findUnique)
const mockFindMany = vi.mocked(prisma.idea.findMany)

describe('deriveIdeaThumbnail', () => {
  it('returns null when no image', () => {
    expect(deriveIdeaThumbnail(null)).toBeNull()
  })

  it('returns adapter thumbnail URL for UPLOAD images', () => {
    const url = deriveIdeaThumbnail({ type: 'UPLOAD', storageKey: 'k', url: null })
    expect(url).toBe('https://r2/k?w=96')
  })

  it('returns the raw URL for LINK images', () => {
    const url = deriveIdeaThumbnail({
      type: 'LINK',
      storageKey: null,
      url: 'https://example.com/photo.jpg',
    })
    expect(url).toBe('https://example.com/photo.jpg')
  })

  it('returns null when UPLOAD has no storageKey', () => {
    expect(deriveIdeaThumbnail({ type: 'UPLOAD', storageKey: null, url: null })).toBeNull()
  })
})

describe('findIdeaById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findIdeaById('i1')).toBeNull()
  })
})

describe('findIdeaForPromotion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('selects only the fields needed by promote action', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'i1',
      title: 't',
      description: null,
      hobbyId: 'h1',
      isPromoted: false,
    } as never)
    await findIdeaForPromotion('i1')
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'i1' },
      select: { id: true, title: true, description: true, hobbyId: true, isPromoted: true },
    })
  })

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findIdeaForPromotion('i1')).toBeNull()
  })
})

describe('findIdeasByHobby', () => {
  beforeEach(() => vi.clearAllMocks())

  it('orders by isPromoted asc then createdAt desc', async () => {
    mockFindMany.mockResolvedValue([])
    await findIdeasByHobby('h1')
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { hobbyId: 'h1' },
      orderBy: [{ isPromoted: 'asc' }, { createdAt: 'desc' }],
      include: { image: { select: { type: true, storageKey: true, url: true } } },
    })
  })

  it('flattens image into thumbnailUrl on each idea', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'i1',
        title: 't',
        hobbyId: 'h1',
        image: { type: 'UPLOAD', storageKey: 'k', url: null },
      },
      { id: 'i2', title: 't2', hobbyId: 'h1', image: null },
    ] as never)
    const result = await findIdeasByHobby('h1')
    expect(result[0]).toMatchObject({ id: 'i1', thumbnailUrl: 'https://r2/k?w=96' })
    expect(result[1]).toMatchObject({ id: 'i2', thumbnailUrl: null })
    // Ensure image field was stripped from result
    expect((result[0] as unknown as { image: unknown }).image).toBeUndefined()
  })
})

describe('findAllIdeas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('includes hobby + image in the include shape', async () => {
    mockFindMany.mockResolvedValue([])
    await findAllIdeas()
    const args = mockFindMany.mock.calls[0][0]
    expect(args.include).toHaveProperty('hobby')
    expect(args.include).toHaveProperty('image')
  })

  it('returns empty array when no ideas', async () => {
    mockFindMany.mockResolvedValue([])
    expect(await findAllIdeas()).toEqual([])
  })
})
