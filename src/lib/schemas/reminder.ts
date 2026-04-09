import { z } from 'zod/v4'

export const reminderTargetTypeEnum = z.enum(['STEP', 'PROJECT'])

export const createReminderSchema = z.object({
  targetType: reminderTargetTypeEnum,
  targetId: z.uuid(),
  dueDate: z.coerce.date(),
})

export type CreateReminderInput = z.infer<typeof createReminderSchema>

export const updateReminderSchema = z.object({
  id: z.uuid(),
  dueDate: z.coerce.date().optional(),
})

export type UpdateReminderInput = z.infer<typeof updateReminderSchema>

export const snoozeReminderSchema = z.object({
  reminderId: z.uuid(),
  snoozeDays: z.union([z.literal(1), z.literal(3), z.literal(7)]),
})

export type SnoozeReminderInput = z.infer<typeof snoozeReminderSchema>

export type DashboardReminder = {
  id: string
  targetType: 'STEP' | 'PROJECT'
  targetId: string
  targetName: string
  dueDate: Date
  isOverdue: boolean
  hobby: { id: string; name: string; color: string; icon: string | null }
  hobbyId: string
  projectId: string
}

export type ReminderData = {
  id: string
  targetType: 'STEP' | 'PROJECT'
  targetId: string
  dueDate: Date
  isDismissed: boolean
  snoozedUntil: Date | null
}
