import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    reminder: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    step: { findMany: vi.fn(), findUnique: vi.fn() },
    project: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  getDashboardReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  getRemindersForTarget,
  dismissReminder,
  snoozeReminder,
} from '../reminder'
import { prisma } from '@/lib/db'

const mockReminderFindMany = vi.mocked(prisma.reminder.findMany)
const mockReminderCreate = vi.mocked(prisma.reminder.create)
const mockReminderUpdate = vi.mocked(prisma.reminder.update)
const mockReminderDelete = vi.mocked(prisma.reminder.delete)
const mockStepFindMany = vi.mocked(prisma.step.findMany)
const mockStepFindUnique = vi.mocked(prisma.step.findUnique)
const mockProjectFindMany = vi.mocked(prisma.project.findMany)
const mockProjectFindUnique = vi.mocked(prisma.project.findUnique)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

const HOBBY = { id: 'h1', name: 'Woodworking', color: '#333', icon: null }

describe('getDashboardReminders — query count (Story 18.2)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('issues at most 3 queries regardless of reminder count (N=10)', async () => {
    // Seed 5 step-targeted + 5 project-targeted reminders — if the old
    // 1+N pattern ever regressed, this would fire 21 queries.
    const now = new Date()
    const reminders = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `s-r-${i}`,
        targetType: 'STEP' as const,
        targetId: `step-${i}`,
        dueDate: new Date(now.getTime() - 1000),
        isDismissed: false,
        snoozedUntil: null,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `p-r-${i}`,
        targetType: 'PROJECT' as const,
        targetId: `proj-${i}`,
        dueDate: new Date(now.getTime() + 1000),
        isDismissed: false,
        snoozedUntil: null,
      })),
    ]
    mockReminderFindMany.mockResolvedValue(reminders as never)

    mockStepFindMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `step-${i}`,
        name: `Step ${i}`,
        project: { id: `sp-${i}`, name: `SP ${i}`, hobbyId: HOBBY.id, hobby: HOBBY },
      })) as never,
    )
    mockProjectFindMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `proj-${i}`,
        name: `Project ${i}`,
        hobbyId: HOBBY.id,
        hobby: HOBBY,
      })) as never,
    )

    const result = await getDashboardReminders()

    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toHaveLength(10)

    // Contract: 1 reminder findMany + 1 step findMany + 1 project findMany = 3
    expect(mockReminderFindMany).toHaveBeenCalledOnce()
    expect(mockStepFindMany).toHaveBeenCalledOnce()
    expect(mockProjectFindMany).toHaveBeenCalledOnce()
    // No 1+N: the old impl called findUnique per reminder; neither should fire here.
  })

  it('skips step/project queries when a targetType has zero matches', async () => {
    // All-project reminders → step.findMany must NOT run
    mockReminderFindMany.mockResolvedValue([
      {
        id: 'r1',
        targetType: 'PROJECT',
        targetId: 'p1',
        dueDate: new Date(),
        isDismissed: false,
        snoozedUntil: null,
      },
    ] as never)
    mockProjectFindMany.mockResolvedValue([
      { id: 'p1', name: 'Only Project', hobbyId: HOBBY.id, hobby: HOBBY },
    ] as never)

    await getDashboardReminders()

    expect(mockReminderFindMany).toHaveBeenCalledOnce()
    expect(mockProjectFindMany).toHaveBeenCalledOnce()
    expect(mockStepFindMany).not.toHaveBeenCalled()
  })

  it('skips project query when all reminders target steps', async () => {
    mockReminderFindMany.mockResolvedValue([
      {
        id: 'r1',
        targetType: 'STEP',
        targetId: 's1',
        dueDate: new Date(),
        isDismissed: false,
        snoozedUntil: null,
      },
    ] as never)
    mockStepFindMany.mockResolvedValue([
      {
        id: 's1',
        name: 'Only Step',
        project: { id: 'p1', name: 'P1', hobbyId: HOBBY.id, hobby: HOBBY },
      },
    ] as never)

    await getDashboardReminders()

    expect(mockProjectFindMany).not.toHaveBeenCalled()
  })

  it('filters out reminders whose target was deleted (targetId not in result)', async () => {
    mockReminderFindMany.mockResolvedValue([
      {
        id: 'r-orphan',
        targetType: 'STEP',
        targetId: 'deleted-step',
        dueDate: new Date(),
        isDismissed: false,
        snoozedUntil: null,
      },
    ] as never)
    mockStepFindMany.mockResolvedValue([] as never) // step was deleted

    const result = await getDashboardReminders()

    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
  })
})

// ==========================================================================
// createReminder — Story 18.4
// ==========================================================================

describe('createReminder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid UUID', async () => {
    const result = await createReminder({
      targetType: 'STEP',
      targetId: 'bad',
      dueDate: new Date('2027-01-01'),
    } as never)
    expect(result.success).toBe(false)
    expect(mockReminderCreate).not.toHaveBeenCalled()
  })

  it('creates a STEP reminder when step exists and project not completed', async () => {
    mockStepFindUnique.mockResolvedValue({
      project: { isCompleted: false },
    } as never)
    mockReminderCreate.mockResolvedValue({ id: 'rem-1' } as never)

    const result = await createReminder({
      targetType: 'STEP',
      targetId: VALID_UUID,
      dueDate: new Date('2027-01-01'),
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('rem-1')
    expect(mockReminderCreate).toHaveBeenCalledOnce()
  })

  it('rejects STEP reminder when step not found', async () => {
    mockStepFindUnique.mockResolvedValue(null)

    const result = await createReminder({
      targetType: 'STEP',
      targetId: VALID_UUID,
      dueDate: new Date('2027-01-01'),
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
    expect(mockReminderCreate).not.toHaveBeenCalled()
  })

  it('rejects STEP reminder when parent project is completed', async () => {
    mockStepFindUnique.mockResolvedValue({
      project: { isCompleted: true },
    } as never)

    const result = await createReminder({
      targetType: 'STEP',
      targetId: VALID_UUID,
      dueDate: new Date('2027-01-01'),
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('completed project')
    expect(mockReminderCreate).not.toHaveBeenCalled()
  })

  it('creates a PROJECT reminder when project exists and not completed', async () => {
    mockProjectFindUnique.mockResolvedValue({ isCompleted: false } as never)
    mockReminderCreate.mockResolvedValue({ id: 'rem-2' } as never)

    const result = await createReminder({
      targetType: 'PROJECT',
      targetId: VALID_UUID,
      dueDate: new Date('2027-01-01'),
    })
    expect(result.success).toBe(true)
  })

  it('rejects PROJECT reminder when project not found', async () => {
    mockProjectFindUnique.mockResolvedValue(null)

    const result = await createReminder({
      targetType: 'PROJECT',
      targetId: VALID_UUID,
      dueDate: new Date('2027-01-01'),
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Project not found.')
  })
})

// ==========================================================================
// updateReminder — Story 18.4
// ==========================================================================

describe('updateReminder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates the reminder due date', async () => {
    mockReminderUpdate.mockResolvedValue({ id: VALID_UUID } as never)
    const result = await updateReminder({
      id: VALID_UUID,
      dueDate: new Date('2027-06-01'),
    })
    expect(result.success).toBe(true)
  })

  it('returns "Reminder not found." on P2025', async () => {
    mockReminderUpdate.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2025' }))
    const result = await updateReminder({
      id: VALID_UUID,
      dueDate: new Date('2027-06-01'),
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Reminder not found.')
  })

  it('rejects invalid UUID', async () => {
    const result = await updateReminder({ id: 'bad', dueDate: new Date() } as never)
    expect(result.success).toBe(false)
    expect(mockReminderUpdate).not.toHaveBeenCalled()
  })
})

// ==========================================================================
// deleteReminder — Story 18.4
// ==========================================================================

describe('deleteReminder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes successfully', async () => {
    mockReminderDelete.mockResolvedValue({ id: VALID_UUID } as never)
    const result = await deleteReminder(VALID_UUID)
    expect(result.success).toBe(true)
  })

  it('returns "Reminder not found." on P2025', async () => {
    mockReminderDelete.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2025' }))
    const result = await deleteReminder(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Reminder not found.')
  })

  it('rejects invalid UUID', async () => {
    const result = await deleteReminder('bad')
    expect(result.success).toBe(false)
    expect(mockReminderDelete).not.toHaveBeenCalled()
  })
})

// ==========================================================================
// getRemindersForTarget — Story 18.4
// ==========================================================================

describe('getRemindersForTarget', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns undismissed reminders sorted by dueDate', async () => {
    mockReminderFindMany.mockResolvedValue([
      { id: 'r1', dueDate: new Date('2027-01-01') },
      { id: 'r2', dueDate: new Date('2027-02-01') },
    ] as never)

    const result = await getRemindersForTarget('STEP', VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toHaveLength(2)

    const call = mockReminderFindMany.mock.calls[0][0] as {
      where: { isDismissed: boolean }
      orderBy: { dueDate: string }
    }
    expect(call.where.isDismissed).toBe(false)
    expect(call.orderBy.dueDate).toBe('asc')
  })

  it('returns empty array when no matches', async () => {
    mockReminderFindMany.mockResolvedValue([] as never)
    const result = await getRemindersForTarget('PROJECT', VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
  })
})

// ==========================================================================
// dismissReminder — Story 18.4
// ==========================================================================

describe('dismissReminder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks reminder as dismissed', async () => {
    mockReminderUpdate.mockResolvedValue({ id: VALID_UUID } as never)
    const result = await dismissReminder(VALID_UUID)
    expect(result.success).toBe(true)
    const call = mockReminderUpdate.mock.calls[0][0] as {
      data: { isDismissed: boolean }
    }
    expect(call.data.isDismissed).toBe(true)
  })

  it('returns "Reminder not found." on P2025', async () => {
    mockReminderUpdate.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2025' }))
    const result = await dismissReminder(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Reminder not found.')
  })

  it('rejects invalid UUID', async () => {
    const result = await dismissReminder('bad')
    expect(result.success).toBe(false)
    expect(mockReminderUpdate).not.toHaveBeenCalled()
  })
})

// ==========================================================================
// snoozeReminder — date arithmetic critical path — Story 18.4
// ==========================================================================

describe('snoozeReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('snoozes for 1 day — snoozedUntil = now + 1d', async () => {
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z'))
    mockReminderUpdate.mockResolvedValue({ id: VALID_UUID } as never)

    await snoozeReminder({ reminderId: VALID_UUID, snoozeDays: 1 })
    const call = mockReminderUpdate.mock.calls[0][0] as {
      data: { snoozedUntil: Date }
    }
    expect(call.data.snoozedUntil.toISOString()).toBe('2026-04-23T10:00:00.000Z')
  })

  it('snoozes for 3 days', async () => {
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z'))
    mockReminderUpdate.mockResolvedValue({ id: VALID_UUID } as never)

    await snoozeReminder({ reminderId: VALID_UUID, snoozeDays: 3 })
    const call = mockReminderUpdate.mock.calls[0][0] as {
      data: { snoozedUntil: Date }
    }
    expect(call.data.snoozedUntil.toISOString()).toBe('2026-04-25T10:00:00.000Z')
  })

  it('snoozes for 7 days — crossing a week boundary', async () => {
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z'))
    mockReminderUpdate.mockResolvedValue({ id: VALID_UUID } as never)

    await snoozeReminder({ reminderId: VALID_UUID, snoozeDays: 7 })
    const call = mockReminderUpdate.mock.calls[0][0] as {
      data: { snoozedUntil: Date }
    }
    expect(call.data.snoozedUntil.toISOString()).toBe('2026-04-29T10:00:00.000Z')
  })

  it('handles DST transition — adds exactly 24h regardless of local offset', async () => {
    // March 8 2026 02:00 UTC — spring-forward morning in US; using UTC math
    // means the snoozedUntil lands exactly 24h later regardless of timezone.
    vi.setSystemTime(new Date('2026-03-08T02:00:00Z'))
    mockReminderUpdate.mockResolvedValue({ id: VALID_UUID } as never)

    await snoozeReminder({ reminderId: VALID_UUID, snoozeDays: 1 })
    const call = mockReminderUpdate.mock.calls[0][0] as {
      data: { snoozedUntil: Date }
    }
    expect(call.data.snoozedUntil.toISOString()).toBe('2026-03-09T02:00:00.000Z')
  })

  it('rejects invalid snoozeDays (not in [1,3,7])', async () => {
    const result = await snoozeReminder({ reminderId: VALID_UUID, snoozeDays: 2 } as never)
    expect(result.success).toBe(false)
    expect(mockReminderUpdate).not.toHaveBeenCalled()
  })

  it('rejects invalid UUID', async () => {
    const result = await snoozeReminder({ reminderId: 'bad', snoozeDays: 1 } as never)
    expect(result.success).toBe(false)
    expect(mockReminderUpdate).not.toHaveBeenCalled()
  })

  it('returns "Reminder not found." on P2025', async () => {
    vi.setSystemTime(new Date('2026-04-22T00:00:00Z'))
    mockReminderUpdate.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2025' }))

    const result = await snoozeReminder({ reminderId: VALID_UUID, snoozeDays: 1 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Reminder not found.')
  })
})
