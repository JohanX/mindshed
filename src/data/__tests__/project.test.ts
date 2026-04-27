import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    stepImage: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(() => ({
    getThumbnailUrl: vi.fn((key: string, w: number) => `https://x/${key}?w=${w}`),
    getPublicUrl: vi.fn((key: string) => `https://x/${key}`),
  })),
}))

import {
  findProjectById,
  findProjectDetail,
  findAllActiveProjects,
  findProjectsByHobby,
  findMaxProjectSortOrder,
} from '../project'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.project.findUnique)
const mockFindMany = vi.mocked(prisma.project.findMany)
const mockAggregate = vi.mocked(prisma.project.aggregate)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('findProjectById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the project on hit', async () => {
    mockFindUnique.mockResolvedValue({ id: VALID_UUID, name: 'Side table' } as never)
    expect(await findProjectById(VALID_UUID)).toMatchObject({ id: VALID_UUID, name: 'Side table' })
  })

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findProjectById(VALID_UUID)).toBeNull()
  })

  it('throws on system error', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB unreachable'))
    await expect(findProjectById(VALID_UUID)).rejects.toThrow('DB unreachable')
  })
})

describe('findProjectDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the rich include shape (hobby + steps + bomItems)', async () => {
    mockFindUnique.mockResolvedValue({
      id: VALID_UUID,
      hobby: {},
      steps: [],
      bomItems: [],
    } as never)
    await findProjectDetail(VALID_UUID)
    const args = mockFindUnique.mock.calls[0][0]
    expect(args.include).toBeDefined()
    expect(args.include).toHaveProperty('hobby')
    expect(args.include).toHaveProperty('steps')
    expect(args.include).toHaveProperty('bomItems')
  })

  it('returns null when project not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findProjectDetail(VALID_UUID)).toBeNull()
  })
})

describe('findAllActiveProjects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters to non-archived non-completed and orders by lastActivityAt desc', async () => {
    mockFindMany.mockResolvedValue([] as never)
    await findAllActiveProjects()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isArchived: false, isCompleted: false },
        orderBy: { lastActivityAt: 'desc' },
      }),
    )
  })

  it('computes derived shape for each project', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Project',
        hobbyId: 'h1',
        steps: [
          { state: 'COMPLETED' },
          { state: 'IN_PROGRESS', name: 'Sand legs' },
          { state: 'NOT_STARTED' },
        ],
        hobby: { name: 'Wood', color: 'c', icon: null },
      },
    ] as never)
    const result = await findAllActiveProjects()
    expect(result[0]).toMatchObject({
      id: 'p1',
      totalSteps: 3,
      completedSteps: 1,
      currentStepName: 'Sand legs',
      hobby: { name: 'Wood', color: 'c', icon: null },
    })
  })

  it('returns empty array when no projects', async () => {
    mockFindMany.mockResolvedValue([] as never)
    expect(await findAllActiveProjects()).toEqual([])
  })
})

describe('findProjectsByHobby', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters by hobbyId', async () => {
    mockFindMany.mockResolvedValue([] as never)
    await findProjectsByHobby('h1')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hobbyId: 'h1' },
        orderBy: { lastActivityAt: 'desc' },
      }),
    )
  })

  it('preserves isArchived/isCompleted flags in the result', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Done',
        hobbyId: 'h1',
        isArchived: true,
        isCompleted: true,
        steps: [{ state: 'COMPLETED' }],
      },
    ] as never)
    const result = await findProjectsByHobby('h1')
    expect(result[0]).toMatchObject({ isArchived: true, isCompleted: true })
  })
})

describe('findMaxProjectSortOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns -1 when no projects', async () => {
    mockAggregate.mockResolvedValue({ _max: { sortOrder: null } } as never)
    expect(await findMaxProjectSortOrder('h1')).toBe(-1)
  })

  it('returns the max sortOrder', async () => {
    mockAggregate.mockResolvedValue({ _max: { sortOrder: 4 } } as never)
    expect(await findMaxProjectSortOrder('h1')).toBe(4)
  })
})
