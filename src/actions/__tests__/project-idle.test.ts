import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma before importing the action
vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
    },
  },
}))

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getIdleProjects } from '../project'
import { prisma } from '@/lib/db'
import { IDLE_THRESHOLD_DAYS } from '@/lib/constants'

const mockFindMany = vi.mocked(prisma.project.findMany)

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

describe('getIdleProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries projects older than IDLE_THRESHOLD_DAYS', async () => {
    mockFindMany.mockResolvedValue([])

    const beforeCall = new Date()
    beforeCall.setDate(beforeCall.getDate() - IDLE_THRESHOLD_DAYS)

    await getIdleProjects()

    expect(mockFindMany).toHaveBeenCalledOnce()
    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs).toMatchObject({
      where: {
        isArchived: false,
        isCompleted: false,
        lastActivityAt: { lt: expect.any(Date) },
      },
      orderBy: { lastActivityAt: 'asc' },
    })

    // The threshold date should be approximately IDLE_THRESHOLD_DAYS ago
    const threshold = (callArgs as { where: { lastActivityAt: { lt: Date } } }).where.lastActivityAt.lt
    const diff = Math.abs(threshold.getTime() - beforeCall.getTime())
    expect(diff).toBeLessThan(5000) // within 5 seconds
  })

  it('returns empty array when no idle projects exist', async () => {
    mockFindMany.mockResolvedValue([])

    const result = await getIdleProjects()
    expect(result).toEqual({ success: true, data: [] })
  })

  it('excludes archived and completed projects via query', async () => {
    mockFindMany.mockResolvedValue([])

    await getIdleProjects()

    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs).toMatchObject({
      where: {
        isArchived: false,
        isCompleted: false,
      },
    })
  })

  it('maps idle projects with correct fields', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Old Project',
        hobbyId: 'h1',
        isArchived: false,
        isCompleted: false,
        lastActivityAt: daysAgo(45),
        steps: [
          { id: 's1', name: 'Done Step', state: 'COMPLETED', sortOrder: 0 },
          { id: 's2', name: 'Current Step', state: 'IN_PROGRESS', sortOrder: 1 },
          { id: 's3', name: 'Blocked Step', state: 'BLOCKED', sortOrder: 2 },
        ],
        hobby: { name: 'Woodworking', color: '#8B4513', icon: null },
      },
    ] as never)

    const result = await getIdleProjects()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(1)
      const project = result.data[0]
      expect(project.id).toBe('p1')
      expect(project.name).toBe('Old Project')
      expect(project.hobbyId).toBe('h1')
      expect(project.totalSteps).toBe(3)
      expect(project.completedSteps).toBe(1)
      expect(project.currentStepName).toBe('Current Step')
      expect(project.currentStepState).toBe('IN_PROGRESS')
      expect(project.hasBlockedSteps).toBe(true)
      expect(project.hobby).toEqual({ name: 'Woodworking', color: '#8B4513', icon: null })
      expect(project.lastActivityAt).toBeInstanceOf(Date)
    }
  })

  it('picks first NOT_STARTED step when no IN_PROGRESS step exists', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Stale Project',
        hobbyId: 'h1',
        isArchived: false,
        isCompleted: false,
        lastActivityAt: daysAgo(60),
        steps: [
          { id: 's1', name: 'Done', state: 'COMPLETED', sortOrder: 0 },
          { id: 's2', name: 'Next Up', state: 'NOT_STARTED', sortOrder: 1 },
          { id: 's3', name: 'Later', state: 'NOT_STARTED', sortOrder: 2 },
        ],
        hobby: { name: 'Painting', color: '#FF0000', icon: null },
      },
    ] as never)

    const result = await getIdleProjects()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0].currentStepName).toBe('Next Up')
      expect(result.data[0].currentStepState).toBe('NOT_STARTED')
    }
  })

  it('handles database errors gracefully', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'))

    const result = await getIdleProjects()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Failed to load idle projects.')
    }
  })
})
