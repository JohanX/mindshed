import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    reminder: {
      findMany: vi.fn(),
    },
  },
}))

import { findRemindersForTarget, findUpcomingReminders } from '../reminder'
import { prisma } from '@/lib/db'

const mockFindMany = vi.mocked(prisma.reminder.findMany)

describe('findRemindersForTarget', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries undismissed reminders ordered by dueDate', async () => {
    mockFindMany.mockResolvedValue([])
    await findRemindersForTarget('STEP', 's1')
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { targetType: 'STEP', targetId: 's1', isDismissed: false },
      orderBy: { dueDate: 'asc' },
    })
  })

  it('returns empty array when none', async () => {
    mockFindMany.mockResolvedValue([])
    expect(await findRemindersForTarget('PROJECT', 'p1')).toEqual([])
  })
})

describe('findUpcomingReminders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters out dismissed and snoozed-past-now reminders, capped at until window', async () => {
    mockFindMany.mockResolvedValue([])
    const now = new Date('2026-04-27T12:00:00Z')
    const until = new Date('2026-05-04T12:00:00Z')
    await findUpcomingReminders(now, until)
    const args = mockFindMany.mock.calls[0][0]
    expect(args.where.isDismissed).toBe(false)
    expect(args.where.OR).toEqual([{ snoozedUntil: null }, { snoozedUntil: { lt: now } }])
    expect(args.where.dueDate).toEqual({ lte: until })
  })
})
