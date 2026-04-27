import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import {
  findPublicGalleryProjects,
  findJourneyGalleryBySlug,
  findResultGalleryBySlug,
  findOtherGallerySlugs,
} from '../gallery'
import { prisma } from '@/lib/db'

const mockFindMany = vi.mocked(prisma.project.findMany)
const mockFindUnique = vi.mocked(prisma.project.findUnique)

describe('findPublicGalleryProjects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries projects with at least one gallery enabled and a slug, ordered by updatedAt desc', async () => {
    mockFindMany.mockResolvedValue([])
    await findPublicGalleryProjects()
    const args = mockFindMany.mock.calls[0][0]
    expect(args.where).toMatchObject({ gallerySlug: { not: null } })
    expect(args.where.OR).toBeDefined()
    expect(args.orderBy).toEqual({ updatedAt: 'desc' })
  })
})

describe('findJourneyGalleryBySlug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when slug not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findJourneyGalleryBySlug('missing')).toBeNull()
  })

  it('selects steps that are not excluded from gallery', async () => {
    mockFindUnique.mockResolvedValue({} as never)
    await findJourneyGalleryBySlug('walnut-table')
    const args = mockFindUnique.mock.calls[0][0]
    expect(args.where).toEqual({ gallerySlug: 'walnut-table' })
    expect(args.select.steps.where).toEqual({ excludeFromGallery: false })
  })
})

describe('findResultGalleryBySlug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('selects only COMPLETED steps ordered by sortOrder desc', async () => {
    mockFindUnique.mockResolvedValue({} as never)
    await findResultGalleryBySlug('s1')
    const args = mockFindUnique.mock.calls[0][0]
    expect(args.select.steps.where).toEqual({ state: 'COMPLETED' })
    expect(args.select.steps.orderBy).toEqual({ sortOrder: 'desc' })
  })
})

describe('findOtherGallerySlugs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flattens to string[] excluding the given id', async () => {
    mockFindMany.mockResolvedValue([
      { gallerySlug: 'foo' },
      { gallerySlug: null },
      { gallerySlug: 'bar' },
    ] as never)
    const result = await findOtherGallerySlugs('exclude')
    expect(result).toEqual(['foo', 'bar'])
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { gallerySlug: { not: null }, id: { not: 'exclude' } },
      select: { gallerySlug: true },
    })
  })
})
