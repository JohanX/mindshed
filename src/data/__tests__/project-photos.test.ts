import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    stepImage: {
      findMany: vi.fn(),
    },
  },
}))

import { fetchLatestPhotosByProject } from '../project-photos'
import { prisma } from '@/lib/db'

const mockFindMany = vi.mocked(prisma.stepImage.findMany)

describe('fetchLatestPhotosByProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty Map when no project ids provided', async () => {
    const result = await fetchLatestPhotosByProject([])
    expect(result.size).toBe(0)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('orders by createdAt desc — project-card hero stays DESC by design', async () => {
    // Story 34.2 / FR131 — step + gallery surfaces flipped to ASC for
    // build-log timeline narrative, but project-card hero photo stays
    // DESC because that surface intentionally surfaces the most-recent
    // photo. This test locks in the asymmetry: a future maintainer who
    // tries to "unify" the ordering will break the project-card hero
    // semantic and this test will fail loudly.
    mockFindMany.mockResolvedValue([])
    await fetchLatestPhotosByProject(['p1', 'p2'])
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { step: { projectId: { in: ['p1', 'p2'] } } },
      orderBy: { createdAt: 'desc' },
      select: {
        storageKey: true,
        originalFilename: true,
        step: { select: { projectId: true } },
      },
    })
  })

  it('returns the FIRST photo per project (most recent given DESC order)', async () => {
    mockFindMany.mockResolvedValue([
      {
        storageKey: 'newest-p1',
        originalFilename: 'newest.jpg',
        step: { projectId: 'p1' },
      },
      {
        storageKey: 'older-p1',
        originalFilename: 'older.jpg',
        step: { projectId: 'p1' },
      },
      {
        storageKey: 'newest-p2',
        originalFilename: 'p2-newest.jpg',
        step: { projectId: 'p2' },
      },
    ] as never)
    const result = await fetchLatestPhotosByProject(['p1', 'p2'])
    expect(result.size).toBe(2)
    expect(result.get('p1')).toEqual({
      storageKey: 'newest-p1',
      originalFilename: 'newest.jpg',
    })
    expect(result.get('p2')).toEqual({
      storageKey: 'newest-p2',
      originalFilename: 'p2-newest.jpg',
    })
  })
})
