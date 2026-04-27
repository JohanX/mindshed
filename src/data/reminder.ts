/**
 * Data access layer for Reminder.
 *
 * Polymorphic targetType (STEP|PROJECT) + targetId (UUID, no FK). Cleanup
 * of stale reminders happens in the entity-deleting actions (per the
 * "Reminder Polymorphic Cleanup" pattern).
 */

import { prisma } from '@/lib/db'
import type { ReminderData } from '@/lib/schemas/reminder'

/** Active (non-dismissed) reminders for a target, ordered by due date. */
export async function findRemindersForTarget(
  targetType: 'STEP' | 'PROJECT',
  targetId: string,
): Promise<ReminderData[]> {
  return prisma.reminder.findMany({
    where: { targetType, targetId, isDismissed: false },
    orderBy: { dueDate: 'asc' },
  })
}

/**
 * Upcoming undismissed reminders due within the window. Filters out
 * reminders snoozed past `now`. Powers the dashboard reminders section.
 */
export async function findUpcomingReminders(now: Date, until: Date) {
  return prisma.reminder.findMany({
    where: {
      isDismissed: false,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
      dueDate: { lte: until },
    },
    orderBy: { dueDate: 'asc' },
  })
}
