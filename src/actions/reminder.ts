'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import {
  createReminderSchema,
  updateReminderSchema,
  snoozeReminderSchema,
  type CreateReminderInput,
  type UpdateReminderInput,
  type SnoozeReminderInput,
  type ReminderData,
  type DashboardReminder,
} from '@/lib/schemas/reminder'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

export async function createReminder(
  input: CreateReminderInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createReminderSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    // Verify target exists and project is not completed
    if (parsed.data.targetType === 'STEP') {
      const step = await prisma.step.findUnique({
        where: { id: parsed.data.targetId },
        select: { project: { select: { isCompleted: true } } },
      })
      if (!step) return { success: false, error: 'Step not found.' }
      if (step.project.isCompleted)
        return { success: false, error: 'Cannot set reminders on a completed project.' }
    } else {
      const project = await prisma.project.findUnique({
        where: { id: parsed.data.targetId },
        select: { isCompleted: true },
      })
      if (!project) return { success: false, error: 'Project not found.' }
      if (project.isCompleted)
        return { success: false, error: 'Cannot set reminders on a completed project.' }
    }

    const reminder = await prisma.reminder.create({
      data: {
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        dueDate: parsed.data.dueDate,
      },
    })

    revalidatePath('/')
    return { success: true, data: { id: reminder.id } }
  } catch (error) {
    console.error('createReminder failed:', error)
    return { success: false, error: 'Failed to set reminder.' }
  }
}

export async function updateReminder(
  input: UpdateReminderInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateReminderSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const reminder = await prisma.reminder.update({
      where: { id: parsed.data.id },
      data: { dueDate: parsed.data.dueDate },
    })

    revalidatePath('/')
    return { success: true, data: { id: reminder.id } }
  } catch (error: unknown) {
    console.error('updateReminder failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Reminder not found.' }
    }
    return { success: false, error: 'Failed to update reminder.' }
  }
}

export async function deleteReminder(reminderId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(reminderId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid reminder ID.' }
  }

  try {
    await prisma.reminder.delete({ where: { id: parsed.data } })
    revalidatePath('/')
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('deleteReminder failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Reminder not found.' }
    }
    return { success: false, error: 'Failed to delete reminder.' }
  }
}

export async function getRemindersForTarget(
  targetType: 'STEP' | 'PROJECT',
  targetId: string,
): Promise<ActionResult<ReminderData[]>> {
  try {
    const reminders = await prisma.reminder.findMany({
      where: { targetType, targetId, isDismissed: false },
      orderBy: { dueDate: 'asc' },
    })
    return { success: true, data: reminders }
  } catch (error) {
    console.error('getRemindersForTarget failed:', error)
    return { success: false, error: 'Failed to load reminders.' }
  }
}

export async function dismissReminder(reminderId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(reminderId)
  if (!parsed.success) return { success: false, error: 'Invalid reminder ID.' }

  try {
    await prisma.reminder.update({ where: { id: parsed.data }, data: { isDismissed: true } })
    revalidatePath('/')
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('dismissReminder failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Reminder not found.' }
    }
    return { success: false, error: 'Failed to dismiss reminder.' }
  }
}

export async function snoozeReminder(input: SnoozeReminderInput): Promise<ActionResult<null>> {
  const parsed = snoozeReminderSchema.safeParse(input)
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  try {
    const snoozedUntil = new Date(Date.now() + parsed.data.snoozeDays * 86400000)
    await prisma.reminder.update({ where: { id: parsed.data.reminderId }, data: { snoozedUntil } })
    revalidatePath('/')
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('snoozeReminder failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Reminder not found.' }
    }
    return { success: false, error: 'Failed to snooze reminder.' }
  }
}

export async function getDashboardReminders(): Promise<ActionResult<DashboardReminder[]>> {
  try {
    const now = new Date()
    const weekFromNow = new Date(Date.now() + 7 * 86400000)

    // Query 1: upcoming undismissed reminders within the next week.
    const reminders = await prisma.reminder.findMany({
      where: {
        isDismissed: false,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
        dueDate: { lte: weekFromNow },
      },
      orderBy: { dueDate: 'asc' },
    })

    // Partition target IDs by targetType so each kind is fetched in a single
    // batched findMany. This replaces the previous 1+N pattern (one findUnique
    // per reminder) with a constant 3 queries regardless of N.
    const stepIds: string[] = []
    const projectIds: string[] = []
    for (const reminder of reminders) {
      if (reminder.targetType === 'STEP') {
        stepIds.push(reminder.targetId)
      } else if (reminder.targetType === 'PROJECT') {
        projectIds.push(reminder.targetId)
      } else {
        // Future-proof: if ReminderTargetType gains a variant without updating
        // this partition, surface a warning instead of silently misrouting.
        console.warn('getDashboardReminders: unhandled targetType', reminder.targetType)
      }
    }

    const hobbySelect = { id: true, name: true, color: true, icon: true } as const
    const [stepRows, projectRows] = await Promise.all([
      stepIds.length > 0
        ? prisma.step.findMany({
            where: { id: { in: stepIds } },
            select: {
              id: true,
              name: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  hobbyId: true,
                  hobby: { select: hobbySelect },
                },
              },
            },
          })
        : Promise.resolve([]),
      projectIds.length > 0
        ? prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: {
              id: true,
              name: true,
              hobbyId: true,
              hobby: { select: hobbySelect },
            },
          })
        : Promise.resolve([]),
    ])

    const stepMap = new Map(stepRows.map((step) => [step.id, step]))
    const projectMap = new Map(projectRows.map((project) => [project.id, project]))

    const enriched: DashboardReminder[] = []
    for (const reminder of reminders) {
      if (reminder.targetType === 'STEP') {
        const step = stepMap.get(reminder.targetId)
        if (!step) continue
        enriched.push({
          id: reminder.id,
          targetType: 'STEP',
          targetId: reminder.targetId,
          targetName: step.name,
          dueDate: reminder.dueDate,
          isOverdue: reminder.dueDate < now,
          hobby: step.project.hobby,
          hobbyId: step.project.hobbyId,
          projectId: step.project.id,
        })
      } else {
        const project = projectMap.get(reminder.targetId)
        if (!project) continue
        enriched.push({
          id: reminder.id,
          targetType: 'PROJECT',
          targetId: reminder.targetId,
          targetName: project.name,
          dueDate: reminder.dueDate,
          isOverdue: reminder.dueDate < now,
          hobby: project.hobby,
          hobbyId: project.hobbyId,
          projectId: project.id,
        })
      }
    }

    // Sort: overdue first, then upcoming
    enriched.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue) return 1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

    return { success: true, data: enriched }
  } catch (error) {
    console.error('getDashboardReminders failed:', error)
    return { success: false, error: 'Failed to load reminders.' }
  }
}
