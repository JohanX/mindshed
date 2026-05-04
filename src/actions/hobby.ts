'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import {
  createHobbySchema,
  updateHobbySchema,
  reorderHobbiesSchema,
  type CreateHobbyInput,
  type UpdateHobbyInput,
  type ReorderHobbiesInput,
  type HobbyWithCounts,
} from '@/lib/schemas/hobby'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import { cleanupStorageKeys } from '@/lib/storage-cleanup'
import { getIdleThresholdDays } from '@/lib/settings'
import { findHobbiesWithCounts } from '@/data/hobby'

export async function createHobby(input: CreateHobbyInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createHobbySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const hobby = await prisma.$transaction(async (tx) => {
      const maxSortOrder = await tx.hobby.aggregate({ _max: { sortOrder: true } })
      const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

      return tx.hobby.create({
        data: {
          name: parsed.data.name,
          color: parsed.data.color,
          icon: parsed.data.icon ?? null,
          sortOrder: nextSortOrder,
          hoursTrackingEnabled: parsed.data.hoursTrackingEnabled,
        },
      })
    })

    revalidatePath('/hobbies')
    revalidatePath('/settings')
    revalidatePath('/')
    return { success: true, data: { id: hobby.id } }
  } catch (error) {
    console.error('createHobby failed:', error)
    return { success: false, error: 'Failed to create hobby. Please try again.' }
  }
}

export async function getHobbies(): Promise<ActionResult<HobbyWithCounts[]>> {
  try {
    const idleThresholdDays = await getIdleThresholdDays()
    const idleThreshold = new Date()
    idleThreshold.setDate(idleThreshold.getDate() - idleThresholdDays)
    const data = await findHobbiesWithCounts(idleThreshold)
    return { success: true, data }
  } catch (error) {
    console.error('getHobbies failed:', error)
    return { success: false, error: 'Failed to load hobbies.' }
  }
}

export async function updateHobby(input: UpdateHobbyInput): Promise<ActionResult<{ id: string }>> {
  const parsed = updateHobbySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const hobby = await prisma.hobby.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        color: parsed.data.color,
        icon: parsed.data.icon ?? null,
        hoursTrackingEnabled: parsed.data.hoursTrackingEnabled,
      },
    })

    revalidatePath('/hobbies')
    revalidatePath('/settings')
    revalidatePath('/')
    return { success: true, data: { id: hobby.id } }
  } catch (error: unknown) {
    console.error('updateHobby failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Hobby not found.' }
    }
    return { success: false, error: 'Failed to update hobby. Please try again.' }
  }
}

export async function deleteHobby(id: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) {
    return { success: false, error: 'Invalid hobby ID' }
  }

  try {
    const storageKeys = await prisma.$transaction(async (tx) => {
      const projects = await tx.project.findMany({
        where: { hobbyId: parsed.data },
        select: { id: true },
      })
      const projectIds = projects.map((project) => project.id)
      const steps = projectIds.length
        ? await tx.step.findMany({
            where: { projectId: { in: projectIds } },
            select: { id: true },
          })
        : []
      const targetIds = [...projectIds, ...steps.map((step) => step.id)]
      if (targetIds.length) {
        await tx.reminder.deleteMany({ where: { targetId: { in: targetIds } } })
      }
      // FR122 / Story 28.1: collect storage keys for every cascade-
      // affected image BEFORE the delete. Two paths converge under hobby:
      //   step_image (via projects → steps under this hobby)
      //   idea_image (via the hobby's ideas)
      const stepImageKeys =
        steps.length > 0
          ? await tx.stepImage.findMany({
              where: {
                stepId: { in: steps.map((step) => step.id) },
                type: 'UPLOAD',
                storageKey: { not: null },
              },
              select: { storageKey: true },
            })
          : []
      const ideaImageKeys = await tx.ideaImage.findMany({
        where: {
          idea: { hobbyId: parsed.data },
          type: 'UPLOAD',
          storageKey: { not: null },
        },
        select: { storageKey: true },
      })
      await tx.hobby.delete({ where: { id: parsed.data } })
      return [...stepImageKeys, ...ideaImageKeys]
    })

    // Best-effort post-commit storage cleanup. Failures NEVER fail the
    // action — see FR122 best-effort guarantee.
    await cleanupStorageKeys(storageKeys)

    revalidatePath('/hobbies')
    revalidatePath('/settings')
    revalidatePath('/inventory')
    revalidatePath('/')
    return { success: true, data: null }
  } catch (error) {
    console.error('deleteHobby failed:', { id }, error)
    return { success: false, error: 'Failed to delete hobby. Please try again.' }
  }
}

export async function reorderHobbies(input: ReorderHobbiesInput): Promise<ActionResult<null>> {
  const parsed = reorderHobbiesSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    await prisma.$transaction(
      parsed.data.orderedIds.map((id, index) =>
        prisma.hobby.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    )

    revalidatePath('/settings')
    revalidatePath('/hobbies')
    revalidatePath('/')
    return { success: true, data: null }
  } catch (error) {
    console.error('reorderHobbies failed:', error)
    return { success: false, error: 'Failed to save new order. Please try again.' }
  }
}
