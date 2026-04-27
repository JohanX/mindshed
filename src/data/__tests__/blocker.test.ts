import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    blocker: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import {
  findBlockerById,
  findActiveBlockers,
  findUnresolvedBlockerForStepAndItem,
} from '../blocker'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.blocker.findUnique)
const mockFindMany = vi.mocked(prisma.blocker.findMany)
const mockFindFirst = vi.mocked(prisma.blocker.findFirst)

describe('findBlockerById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findBlockerById('b1')).toBeNull()
  })

  it('throws on system error', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB unreachable'))
    await expect(findBlockerById('b1')).rejects.toThrow('DB unreachable')
  })
})

describe('findActiveBlockers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries unresolved blockers ordered by createdAt desc', async () => {
    mockFindMany.mockResolvedValue([])
    await findActiveBlockers()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isResolved: false },
        orderBy: { createdAt: 'desc' },
      }),
    )
  })

  it('includes step + project + hobby in the select shape', async () => {
    mockFindMany.mockResolvedValue([])
    await findActiveBlockers()
    const args = mockFindMany.mock.calls[0][0]
    expect(args.select.step.select).toHaveProperty('id')
    expect(args.select.step.select).toHaveProperty('name')
    expect(args.select.step.select.project).toBeDefined()
  })

  it('returns empty array when no active blockers', async () => {
    mockFindMany.mockResolvedValue([])
    expect(await findActiveBlockers()).toEqual([])
  })
})

describe('findUnresolvedBlockerForStepAndItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the existing blocker when match found (dedup hit)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'b-existing' } as never)
    const result = await findUnresolvedBlockerForStepAndItem('s1', 'inv1')
    expect(result).toEqual({ id: 'b-existing' })
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { stepId: 's1', inventoryItemId: 'inv1', isResolved: false },
      select: { id: true },
    })
  })

  it('returns null when no dedup match', async () => {
    mockFindFirst.mockResolvedValue(null)
    expect(await findUnresolvedBlockerForStepAndItem('s1', 'inv1')).toBeNull()
  })
})
