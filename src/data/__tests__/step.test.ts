import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    step: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))

import {
  findStepById,
  findStepWithProject,
  findStepsForProject,
  findMaxStepSortOrder,
} from '../step'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.step.findUnique)
const mockFindMany = vi.mocked(prisma.step.findMany)
const mockAggregate = vi.mocked(prisma.step.aggregate)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('findStepById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the step on hit', async () => {
    mockFindUnique.mockResolvedValue({ id: VALID_UUID, name: 'Sand legs' } as never)
    expect(await findStepById(VALID_UUID)).toMatchObject({ id: VALID_UUID, name: 'Sand legs' })
  })

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findStepById(VALID_UUID)).toBeNull()
  })

  it('throws on system error', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB unreachable'))
    await expect(findStepById(VALID_UUID)).rejects.toThrow('DB unreachable')
  })
})

describe('findStepWithProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests step + project context (id, hobbyId, isCompleted)', async () => {
    mockFindUnique.mockResolvedValue({
      id: VALID_UUID,
      project: { id: 'p1', hobbyId: 'h1', isCompleted: false },
    } as never)
    await findStepWithProject(VALID_UUID)
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_UUID },
        select: expect.objectContaining({
          project: expect.any(Object),
        }),
      }),
    )
  })

  it('returns null when step not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findStepWithProject(VALID_UUID)).toBeNull()
  })
})

describe('findStepsForProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('orders by sortOrder asc', async () => {
    mockFindMany.mockResolvedValue([])
    await findStepsForProject('p1')
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
      orderBy: { sortOrder: 'asc' },
    })
  })
})

describe('findMaxStepSortOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns -1 when no steps', async () => {
    mockAggregate.mockResolvedValue({ _max: { sortOrder: null } } as never)
    expect(await findMaxStepSortOrder('p1')).toBe(-1)
  })

  it('returns the max sortOrder', async () => {
    mockAggregate.mockResolvedValue({ _max: { sortOrder: 9 } } as never)
    expect(await findMaxStepSortOrder('p1')).toBe(9)
  })
})
