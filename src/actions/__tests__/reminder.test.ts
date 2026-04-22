import { describe, it, expect, vi, beforeEach } from 'vitest'

// Story 18.2 — seed file. Only covers the query-count refactor of
// getDashboardReminders. Story 18.4 extends this with full coverage
// for all 7 exports (createReminder, updateReminder, deleteReminder,
// getRemindersForTarget, dismissReminder, snoozeReminder).
vi.mock('@/lib/db', () => ({
  prisma: {
    reminder: { findMany: vi.fn() },
    step: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getDashboardReminders } from '../reminder'
import { prisma } from '@/lib/db'

const mockReminderFindMany = vi.mocked(prisma.reminder.findMany)
const mockStepFindMany = vi.mocked(prisma.step.findMany)
const mockProjectFindMany = vi.mocked(prisma.project.findMany)

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
