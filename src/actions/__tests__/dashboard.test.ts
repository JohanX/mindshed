import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    hobby: { count: vi.fn() },
    project: { findMany: vi.fn() },
    blocker: { findMany: vi.fn() },
    stepImage: { findMany: vi.fn() },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/settings', () => ({
  getIdleThresholdDays: vi.fn(async () => 30),
}))

import { getDashboardData } from '../dashboard'
import { prisma } from '@/lib/db'

const mockHobbyCount = vi.mocked(prisma.hobby.count)
const mockProjectFindMany = vi.mocked(prisma.project.findMany)
const mockBlockerFindMany = vi.mocked(prisma.blocker.findMany)
const mockStepImageFindMany = vi.mocked(prisma.stepImage.findMany)

// getDashboardData calls prisma.project.findMany 3 times:
//   1. recentProjects — include: { hobby, steps }
//   2. idleProjects   — include: { hobby, steps }
//   3. rawGalleries   — select: { gallerySlug, ... }  (disambiguated via select.gallerySlug)
// setProjectFindManyReturns wires a single mockImplementation that returns
// the provided list for the include-shape calls and an empty list for the
// gallery select-shape call (so `steps.flatMap(s => s.images)` is a no-op).
function setProjectFindManyReturns(data: unknown[]) {
  mockProjectFindMany.mockImplementation(async (args: unknown) => {
    const a = args as { select?: { gallerySlug?: boolean } } | undefined
    if (a?.select?.gallerySlug) return [] as never
    return data as never
  })
}

describe('getDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns dashboard data with all sections', async () => {
    mockHobbyCount.mockResolvedValue(3)
    setProjectFindManyReturns([
      {
        id: 'p1',
        name: 'Recent Project',
        hobbyId: 'h1',
        lastActivityAt: new Date(),
        hobby: { id: 'h1', name: 'Woodworking', color: '#8B4513', icon: null },
        steps: [{ id: 's1', name: 'Cut wood', state: 'IN_PROGRESS', sortOrder: 0 }],
      },
    ])
    mockBlockerFindMany.mockResolvedValue([])
    mockStepImageFindMany.mockResolvedValue([])

    const result = await getDashboardData()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalHobbies).toBe(3)
      expect(result.data.recentProjects).toHaveLength(1)
      expect(result.data.recentProjects[0].name).toBe('Recent Project')
      expect(result.data.recentProjects[0].currentStep?.name).toBe('Cut wood')
      expect(result.data.activeBlockers).toHaveLength(0)
    }
  })

  it('returns empty arrays when no data exists', async () => {
    mockHobbyCount.mockResolvedValue(0)
    setProjectFindManyReturns([])
    mockBlockerFindMany.mockResolvedValue([])
    mockStepImageFindMany.mockResolvedValue([])

    const result = await getDashboardData()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalHobbies).toBe(0)
      expect(result.data.recentProjects).toHaveLength(0)
      expect(result.data.activeBlockers).toHaveLength(0)
      expect(result.data.idleProjects).toHaveLength(0)
    }
  })

  it('returns error on database failure', async () => {
    mockHobbyCount.mockRejectedValue(new Error('DB down'))

    const result = await getDashboardData()

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Failed to load dashboard')
    }
  })

  it('includes blocker context data', async () => {
    mockHobbyCount.mockResolvedValue(1)
    setProjectFindManyReturns([])
    mockBlockerFindMany.mockResolvedValue([
      {
        id: 'b1',
        description: 'Need glue',
        createdAt: new Date(),
        step: {
          id: 's1',
          name: 'Assembly',
          project: {
            id: 'p1',
            name: 'Table',
            hobbyId: 'h1',
            hobby: { id: 'h1', name: 'Woodworking', color: '#8B4513', icon: null },
          },
        },
      },
    ] as never)
    mockStepImageFindMany.mockResolvedValue([])

    const result = await getDashboardData()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.activeBlockers).toHaveLength(1)
      expect(result.data.activeBlockers[0].description).toBe('Need glue')
      expect(result.data.activeBlockers[0].step.project.name).toBe('Table')
    }
  })

  it('batches latest photo fetch per project', async () => {
    mockHobbyCount.mockResolvedValue(1)
    setProjectFindManyReturns([
      {
        id: 'p1',
        name: 'Project',
        hobbyId: 'h1',
        lastActivityAt: new Date(),
        hobby: { id: 'h1', name: 'Hobby', color: '#000', icon: null },
        steps: [{ id: 's1', name: 'Step', state: 'NOT_STARTED', sortOrder: 0 }],
      },
    ])
    mockBlockerFindMany.mockResolvedValue([])
    mockStepImageFindMany.mockResolvedValue([
      {
        storageKey: 'steps/s1/photo.jpg',
        originalFilename: 'photo.jpg',
        step: { projectId: 'p1' },
      },
    ] as never)

    const result = await getDashboardData()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recentProjects[0].latestPhoto?.storageKey).toBe('steps/s1/photo.jpg')
    }
    // Should use findMany (batch) not findFirst (N+1)
    expect(mockStepImageFindMany).toHaveBeenCalledTimes(1)
  })
})
