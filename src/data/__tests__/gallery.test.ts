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
    const args = mockFindMany.mock.calls[0]![0] as {
      where: { gallerySlug: unknown; OR: unknown }
      orderBy: unknown
    }
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

  it('selects ALL steps and exposes excludeFromGallery so caller can filter', async () => {
    // Story 30.5 / FR129 — accessor returns ALL steps so the FR129 hours
    // total sums the whole project (not just gallery-visible steps).
    // The page renderer + metadata helper filter `excludeFromGallery` at
    // render time. Keeps journey/result/detail totals consistent.
    mockFindUnique.mockResolvedValue({} as never)
    await findJourneyGalleryBySlug('walnut-table')
    const args = mockFindUnique.mock.calls[0]![0] as {
      where: unknown
      select: {
        steps: {
          where?: unknown
          select: { excludeFromGallery: boolean; hoursLogged: boolean }
        }
      }
    }
    expect(args.where).toEqual({ gallerySlug: 'walnut-table' })
    expect(args.select.steps.where).toBeUndefined()
    expect(args.select.steps.select.excludeFromGallery).toBe(true)
    expect(args.select.steps.select.hoursLogged).toBe(true)
  })
})

describe('findResultGalleryBySlug', () => {
  beforeEach(() => vi.clearAllMocks())

  it('selects all step states ordered by sortOrder desc — caller filters by state', async () => {
    // Story 30.5 / FR129 — the result accessor exposes ALL steps so the
    // gallery page can sum hours across the whole project. The page (and
    // the metadata helper) filter to state=COMPLETED before picking the
    // displayed result step.
    mockFindUnique.mockResolvedValue({} as never)
    await findResultGalleryBySlug('s1')
    const args = mockFindUnique.mock.calls[0]![0] as {
      select: {
        steps: {
          where?: unknown
          orderBy: unknown
          select: { state: boolean }
        }
      }
    }
    expect(args.select.steps.where).toBeUndefined()
    expect(args.select.steps.orderBy).toEqual({ sortOrder: 'desc' })
    expect(args.select.steps.select.state).toBe(true)
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
