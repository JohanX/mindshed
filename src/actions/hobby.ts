'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import { createHobbySchema, updateHobbySchema, reorderHobbiesSchema, type CreateHobbyInput, type UpdateHobbyInput, type ReorderHobbiesInput, type HobbyWithCounts } from '@/lib/schemas/hobby'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import { getIdleThresholdDays } from '@/lib/settings'

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
    const hobbies = await prisma.hobby.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        projects: {
          select: {
            id: true,
            isArchived: true,
            isCompleted: true,
            lastActivityAt: true,
            steps: { select: { state: true } },
          },
        },
      },
    })

    const idleThresholdDays = await getIdleThresholdDays()
    const idleThreshold = new Date()
    idleThreshold.setDate(idleThreshold.getDate() - idleThresholdDays)

    return {
      success: true,
      data: hobbies.map(h => {
        const active = h.projects.filter(p => !p.isArchived && !p.isCompleted)
        const blocked = active.filter(p => p.steps.some(s => s.state === 'BLOCKED'))
        const idle = active.filter(p => p.lastActivityAt < idleThreshold)
        return {
          id: h.id,
          name: h.name,
          color: h.color,
          icon: h.icon,
          sortOrder: h.sortOrder,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
          projectCount: h.projects.length,
          activeCount: active.length,
          blockedCount: blocked.length,
          idleCount: idle.length,
        }
      }),
    }
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
    await prisma.hobby.delete({
      where: { id: parsed.data },
    })

    revalidatePath('/hobbies')
    revalidatePath('/settings')
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
        })
      )
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
