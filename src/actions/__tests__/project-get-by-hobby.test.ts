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

import { getProjectsByHobby } from '../project'
import { prisma } from '@/lib/db'

const mockFindMany = vi.mocked(prisma.project.findMany)

describe('getProjectsByHobby', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid hobbyId', async () => {
    const result = await getProjectsByHobby('not-a-uuid')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Invalid hobby ID')
    }
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('returns projects ordered by lastActivityAt', async () => {
    const mockProjects = [
      {
        id: 'p1', name: 'Recent', hobbyId: 'h1', isArchived: false, isCompleted: false,
        lastActivityAt: new Date('2026-04-06'),
        steps: [
          { id: 's1', name: 'Step 1', state: 'COMPLETED', sortOrder: 0 },
          { id: 's2', name: 'Step 2', state: 'IN_PROGRESS', sortOrder: 1 },
        ],
      },
      {
        id: 'p2', name: 'Older', hobbyId: 'h1', isArchived: false, isCompleted: false,
        lastActivityAt: new Date('2026-04-01'),
        steps: [{ id: 's3', name: 'Step A', state: 'NOT_STARTED', sortOrder: 0 }],
      },
    ]
    mockFindMany.mockResolvedValue(mockProjects as never)

    const result = await getProjectsByHobby('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].name).toBe('Recent')
      expect(result.data[1].name).toBe('Older')
    }
  })

  it('computes step progress counts correctly', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'p1', name: 'Project', hobbyId: 'h1', isArchived: false, isCompleted: false,
        lastActivityAt: new Date(),
        steps: [
          { id: 's1', name: 'Done', state: 'COMPLETED', sortOrder: 0 },
          { id: 's2', name: 'Doing', state: 'IN_PROGRESS', sortOrder: 1 },
          { id: 's3', name: 'Blocked', state: 'BLOCKED', sortOrder: 2 },
          { id: 's4', name: 'Todo', state: 'NOT_STARTED', sortOrder: 3 },
        ],
      },
    ] as never)

    const result = await getProjectsByHobby('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    if (result.success) {
      const p = result.data[0]
      expect(p.totalSteps).toBe(4)
      expect(p.completedSteps).toBe(1)
      expect(p.currentStepName).toBe('Doing')
      expect(p.derivedStatus).toBe('BLOCKED')
    }
  })

  it('includes archived projects flagged in response', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'p1', name: 'Active', hobbyId: 'h1', isArchived: false, isCompleted: false,
        lastActivityAt: new Date(),
        steps: [{ id: 's1', name: 'Step', state: 'NOT_STARTED', sortOrder: 0 }],
      },
      {
        id: 'p2', name: 'Archived', hobbyId: 'h1', isArchived: true, isCompleted: false,
        lastActivityAt: new Date(),
        steps: [{ id: 's2', name: 'Step', state: 'COMPLETED', sortOrder: 0 }],
      },
    ] as never)

    const result = await getProjectsByHobby('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].isArchived).toBe(false)
      expect(result.data[1].isArchived).toBe(true)
    }
  })

  it('returns current step as first IN_PROGRESS or NOT_STARTED by sortOrder', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'p1', name: 'Project', hobbyId: 'h1', isArchived: false, isCompleted: false,
        lastActivityAt: new Date(),
        steps: [
          { id: 's1', name: 'Done Step', state: 'COMPLETED', sortOrder: 0 },
          { id: 's2', name: 'Current Step', state: 'NOT_STARTED', sortOrder: 1 },
          { id: 's3', name: 'Later Step', state: 'NOT_STARTED', sortOrder: 2 },
        ],
      },
    ] as never)

    const result = await getProjectsByHobby('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0].currentStepName).toBe('Current Step')
    }
  })

  it('handles database errors gracefully', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'))

    const result = await getProjectsByHobby('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Failed to load projects.')
    }
  })
})
