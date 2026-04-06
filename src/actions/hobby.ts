'use server'

import { prisma } from '@/lib/db'
import { createHobbySchema, type CreateHobbyInput, type HobbyWithCounts } from '@/lib/schemas/hobby'
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
