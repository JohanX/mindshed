import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    hobby: {
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/settings', () => ({
  getIdleThresholdDays: vi.fn().mockResolvedValue(30),
}))

import { createHobby, getHobbies, updateHobby, deleteHobby, reorderHobbies } from '../hobby'
import { prisma } from '@/lib/db'

const mockHobbyFindMany = vi.mocked(prisma.hobby.findMany)
const mockHobbyUpdate = vi.mocked(prisma.hobby.update)
const mockHobbyDelete = vi.mocked(prisma.hobby.delete)
const mockProjectGroupBy = vi.mocked(prisma.project.groupBy)
const mockTransaction = vi.mocked(prisma.$transaction)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_COLOR = 'hsl(25, 45%, 40%)' // Walnut

describe('createHobby', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid color', async () => {
    const result = await createHobby({
      name: 'Woodworking',
      color: '#not-in-palette',
    } as never)
    expect(result.success).toBe(false)
  })

  it('rejects empty name', async () => {
    const result = await createHobby({ name: '', color: VALID_COLOR })
    expect(result.success).toBe(false)
  })

  it('rejects name >100 chars', async () => {
    const result = await createHobby({ name: 'x'.repeat(101), color: VALID_COLOR })
    expect(result.success).toBe(false)
  })

  it('creates with next sortOrder when valid', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        hobby: {
          aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: 2 } }),
          create: vi.fn().mockResolvedValue({ id: 'h-new' }),
        },
      }
      return fn(tx as never)
    })

    const result = await createHobby({ name: 'Pottery', color: VALID_COLOR })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('h-new')
  })
})

// ==========================================================================
// getHobbies — Story 18.2 rewrite; Story 18.4 covers the _count path
// ==========================================================================

describe('getHobbies', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all-zero counts for a brand-new hobby with 0 projects', async () => {
    mockHobbyFindMany.mockResolvedValue([
      {
        id: 'h1',
        name: 'Woodworking',
        color: VALID_COLOR,
        icon: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { projects: 0 },
      },
    ] as never)
    // All 3 groupBy calls return empty (no projects match)
    mockProjectGroupBy.mockResolvedValue([] as never)

    const result = await getHobbies()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        id: 'h1',
        projectCount: 0,
        activeCount: 0,
        blockedCount: 0,
        idleCount: 0,
      })
    }
  })

  it('combines counts from 4 aggregates into one hobby row', async () => {
    mockHobbyFindMany.mockResolvedValue([
      {
        id: 'h1',
        name: 'Woodworking',
        color: VALID_COLOR,
        icon: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { projects: 10 }, // total — including archived/completed
      },
    ] as never)
    // Call sequence: active, blocked, idle
    mockProjectGroupBy
      .mockResolvedValueOnce([{ hobbyId: 'h1', _count: { _all: 7 } }] as never)
      .mockResolvedValueOnce([{ hobbyId: 'h1', _count: { _all: 2 } }] as never)
      .mockResolvedValueOnce([{ hobbyId: 'h1', _count: { _all: 1 } }] as never)

    const result = await getHobbies()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0]).toMatchObject({
        projectCount: 10,
        activeCount: 7,
        blockedCount: 2,
        idleCount: 1,
      })
    }
  })

  it('orders hobbies by sortOrder asc', async () => {
    mockHobbyFindMany.mockResolvedValue([] as never)
    mockProjectGroupBy.mockResolvedValue([] as never)
    await getHobbies()

    const call = mockHobbyFindMany.mock.calls[0][0] as {
      orderBy: { sortOrder: string }
    }
    expect(call.orderBy.sortOrder).toBe('asc')
  })

  it('fires exactly 4 queries (1 hobby + 3 groupBy) regardless of hobby count', async () => {
    mockHobbyFindMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `h${i}`,
        name: `H${i}`,
        color: VALID_COLOR,
        icon: null,
        sortOrder: i,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { projects: 5 },
      })) as never,
    )
    mockProjectGroupBy.mockResolvedValue([] as never)

    await getHobbies()

    expect(mockHobbyFindMany).toHaveBeenCalledOnce()
    expect(mockProjectGroupBy).toHaveBeenCalledTimes(3)
  })

  it('active groupBy filters out archived and completed projects', async () => {
    mockHobbyFindMany.mockResolvedValue([] as never)
    mockProjectGroupBy.mockResolvedValue([] as never)
    await getHobbies()

    const activeCall = mockProjectGroupBy.mock.calls[0][0] as {
      where: { isArchived: boolean; isCompleted: boolean }
    }
    expect(activeCall.where.isArchived).toBe(false)
    expect(activeCall.where.isCompleted).toBe(false)
  })

  it('blocked groupBy filters by a BLOCKED step existing', async () => {
    mockHobbyFindMany.mockResolvedValue([] as never)
    mockProjectGroupBy.mockResolvedValue([] as never)
    await getHobbies()

    const blockedCall = mockProjectGroupBy.mock.calls[1][0] as {
      where: { steps: { some: { state: string } } }
    }
    expect(blockedCall.where.steps.some.state).toBe('BLOCKED')
  })

  it('idle groupBy filters by lastActivityAt < threshold', async () => {
    mockHobbyFindMany.mockResolvedValue([] as never)
    mockProjectGroupBy.mockResolvedValue([] as never)
    await getHobbies()

    const idleCall = mockProjectGroupBy.mock.calls[2][0] as {
      where: { lastActivityAt: { lt: Date } }
    }
    expect(idleCall.where.lastActivityAt.lt).toBeInstanceOf(Date)
  })
})

// ==========================================================================
// updateHobby
// ==========================================================================

describe('updateHobby', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates valid fields', async () => {
    mockHobbyUpdate.mockResolvedValue({ id: VALID_UUID } as never)
    const result = await updateHobby({
      id: VALID_UUID,
      name: 'Renamed',
      color: VALID_COLOR,
    })
    expect(result.success).toBe(true)
  })

  it('returns "Hobby not found." on P2025', async () => {
    mockHobbyUpdate.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2025' }))
    const result = await updateHobby({
      id: VALID_UUID,
      name: 'Test',
      color: VALID_COLOR,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Hobby not found.')
  })

  it('rejects invalid UUID', async () => {
    const result = await updateHobby({
      id: 'bad',
      name: 'Test',
      color: VALID_COLOR,
    })
    expect(result.success).toBe(false)
    expect(mockHobbyUpdate).not.toHaveBeenCalled()
  })
})

// ==========================================================================
// deleteHobby
// ==========================================================================

describe('deleteHobby', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes hobby, cleans up reminders for projects/steps, revalidates inventory', async () => {
    const mockProjectFindMany = vi.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])
    const mockStepFindMany = vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    const mockReminderDeleteMany = vi.fn().mockResolvedValue({ count: 2 })
    const mockHobbyDeleteTx = vi.fn().mockResolvedValue({ id: VALID_UUID })

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: { findMany: mockProjectFindMany },
        step: { findMany: mockStepFindMany },
        reminder: { deleteMany: mockReminderDeleteMany },
        hobby: { delete: mockHobbyDeleteTx },
      }
      return fn(tx as never)
    })

    const { revalidatePath: mockRevalidatePath } = await import('next/cache')
    const result = await deleteHobby(VALID_UUID)
    expect(result.success).toBe(true)

    expect(mockReminderDeleteMany).toHaveBeenCalledWith({
      where: { targetId: { in: ['p1', 'p2', 's1', 's2'] } },
    })
    expect(vi.mocked(mockRevalidatePath)).toHaveBeenCalledWith('/inventory')
  })

  it('skips reminder cleanup when hobby has no projects', async () => {
    const mockProjectFindMany = vi.fn().mockResolvedValue([])
    const mockReminderDeleteMany = vi.fn()
    const mockHobbyDeleteTx = vi.fn().mockResolvedValue({ id: VALID_UUID })

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: { findMany: mockProjectFindMany },
        step: { findMany: vi.fn() },
        reminder: { deleteMany: mockReminderDeleteMany },
        hobby: { delete: mockHobbyDeleteTx },
      }
      return fn(tx as never)
    })

    const result = await deleteHobby(VALID_UUID)
    expect(result.success).toBe(true)
    expect(mockReminderDeleteMany).not.toHaveBeenCalled()
  })

  it('rejects invalid UUID', async () => {
    const result = await deleteHobby('bad')
    expect(result.success).toBe(false)
  })

  it('returns generic error on unexpected failure', async () => {
    mockTransaction.mockRejectedValue(new Error('DB error'))
    const result = await deleteHobby(VALID_UUID)
    expect(result.success).toBe(false)
  })
})

// ==========================================================================
// reorderHobbies
// ==========================================================================

describe('reorderHobbies', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty orderedIds', async () => {
    const result = await reorderHobbies({ orderedIds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects duplicate IDs in orderedIds', async () => {
    const result = await reorderHobbies({
      orderedIds: [VALID_UUID, VALID_UUID],
    })
    expect(result.success).toBe(false)
  })

  it('persists sortOrder as array index', async () => {
    mockTransaction.mockResolvedValue([])
    const result = await reorderHobbies({
      orderedIds: [VALID_UUID, '550e8400-e29b-41d4-a716-446655440001'],
    })
    expect(result.success).toBe(true)
    expect(mockTransaction).toHaveBeenCalledOnce()
  })
})
