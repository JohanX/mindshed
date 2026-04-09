'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import { createReminderSchema, updateReminderSchema, type CreateReminderInput, type UpdateReminderInput, type ReminderData } from '@/lib/schemas/reminder'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

export async function createReminder(input: CreateReminderInput): Promise<ActionResult<{ id: string }>> {
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
      if (step.project.isCompleted) return { success: false, error: 'Cannot set reminders on a completed project.' }
    } else {
      const project = await prisma.project.findUnique({
        where: { id: parsed.data.targetId },
        select: { isCompleted: true },
      })
      if (!project) return { success: false, error: 'Project not found.' }
      if (project.isCompleted) return { success: false, error: 'Cannot set reminders on a completed project.' }
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

export async function updateReminder(input: UpdateReminderInput): Promise<ActionResult<{ id: string }>> {
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
