'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import { createHobbySchema, updateHobbySchema, reorderHobbiesSchema, type CreateHobbyInput, type UpdateHobbyInput, type ReorderHobbiesInput, type HobbyWithCounts } from '@/lib/schemas/hobby'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

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
    })
    return {
      success: true,
      // TODO(epic-3): Replace hardcoded zeros with real counts via Prisma _count when Project model exists
      data: hobbies.map(h => ({
        ...h,
        projectCount: 0,
        activeCount: 0,
        blockedCount: 0,
        idleCount: 0,
      })),
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
  } catch (error) {
    console.error('updateHobby failed:', error)
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
    return { success: true, data: null }
  } catch (error) {
    console.error('reorderHobbies failed:', error)
    return { success: false, error: 'Failed to save new order. Please try again.' }
  }
}
