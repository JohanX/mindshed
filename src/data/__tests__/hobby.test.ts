import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    hobby: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    project: {
      groupBy: vi.fn(),
    },
  },
}))

import {
  findHobbyById,
  findHobbyHeader,
  findHobbiesWithCounts,
  findAllHobbiesOrdered,
  findMaxHobbySortOrder,
} from '../hobby'
import { prisma } from '@/lib/db'

const mockFindUnique = vi.mocked(prisma.hobby.findUnique)
const mockFindMany = vi.mocked(prisma.hobby.findMany)
const mockAggregate = vi.mocked(prisma.hobby.aggregate)
const mockProjectGroupBy = vi.mocked(prisma.project.groupBy)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('findHobbyById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the hobby on hit', async () => {
    mockFindUnique.mockResolvedValue({ id: VALID_UUID, name: 'Pottery' } as never)
    const result = await findHobbyById(VALID_UUID)
    expect(result).toEqual({ id: VALID_UUID, name: 'Pottery' })
  })

  it('returns null when no row matches', async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await findHobbyById(VALID_UUID)
    expect(result).toBeNull()
  })

  it('throws on system error', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB unreachable'))
    await expect(findHobbyById(VALID_UUID)).rejects.toThrow('DB unreachable')
  })
})

describe('findHobbyHeader', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns minimal header projection', async () => {
    mockFindUnique.mockResolvedValue({
      id: VALID_UUID,
      name: 'Pottery',
      color: 'hsl(25, 45%, 40%)',
      icon: 'hammer',
    } as never)
    const result = await findHobbyHeader(VALID_UUID)
    expect(result).toMatchObject({
      id: VALID_UUID,
      name: 'Pottery',
      color: 'hsl(25, 45%, 40%)',
      icon: 'hammer',
    })
  })

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findHobbyHeader(VALID_UUID)).toBeNull()
  })
})

describe('findHobbiesWithCounts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns hobbies with all four count buckets populated', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'h1',
        name: 'Pottery',
        color: 'c',
        icon: null,
        sortOrder: 0,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        _count: { projects: 5 },
      },
    ] as never)
    mockProjectGroupBy
      .mockResolvedValueOnce([{ hobbyId: 'h1', _count: { _all: 3 } }] as never)
      .mockResolvedValueOnce([{ hobbyId: 'h1', _count: { _all: 1 } }] as never)
      .mockResolvedValueOnce([{ hobbyId: 'h1', _count: { _all: 2 } }] as never)

    const result = await findHobbiesWithCounts(new Date('2026-03-01'))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'h1',
      projectCount: 5,
      activeCount: 3,
      blockedCount: 1,
      idleCount: 2,
    })
  })

  it('defaults missing groupBy rows to 0', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'h1',
        name: 'Pottery',
        color: 'c',
        icon: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { projects: 0 },
      },
    ] as never)
    mockProjectGroupBy
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)

    const result = await findHobbiesWithCounts(new Date('2026-03-01'))
    expect(result[0]).toMatchObject({
      activeCount: 0,
      blockedCount: 0,
      idleCount: 0,
    })
  })

  it('throws on system error', async () => {
    mockFindMany.mockRejectedValue(new Error('DB unreachable'))
    await expect(findHobbiesWithCounts(new Date())).rejects.toThrow('DB unreachable')
  })
})

describe('findAllHobbiesOrdered', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns ordered minimal projection', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'h1', name: 'Pottery', color: 'c1', icon: null },
    ] as never)
    const result = await findAllHobbiesOrdered()
    expect(result).toHaveLength(1)
    expect(mockFindMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, color: true, icon: true },
    })
  })

  it('returns empty list when no hobbies', async () => {
    mockFindMany.mockResolvedValue([])
    const result = await findAllHobbiesOrdered()
    expect(result).toEqual([])
  })
})

describe('findMaxHobbySortOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns -1 when no hobbies', async () => {
    mockAggregate.mockResolvedValue({ _max: { sortOrder: null } } as never)
    expect(await findMaxHobbySortOrder()).toBe(-1)
  })

  it('returns the max sortOrder', async () => {
    mockAggregate.mockResolvedValue({ _max: { sortOrder: 7 } } as never)
    expect(await findMaxHobbySortOrder()).toBe(7)
  })
})
