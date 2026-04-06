'use server'

import { prisma } from '@/lib/db'
import { createProjectSchema, type CreateProjectInput } from '@/lib/schemas/project'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

export async function createProject(input: CreateProjectInput): Promise<ActionResult<{ id: string; hobbyId: string }>> {
  const parsed = createProjectSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { name, description, hobbyId, steps } = parsed.data

  try {
    const project = await prisma.$transaction(async (tx) => {
      // Verify hobby exists inside transaction
      const hobby = await tx.hobby.findUnique({ where: { id: hobbyId } })
      if (!hobby) throw new Error('HOBBY_NOT_FOUND')

      const maxSort = await tx.project.aggregate({
        where: { hobbyId },
        _max: { sortOrder: true },
      })

      return tx.project.create({
        data: {
          name,
          description: description ?? null,
          hobbyId,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
          lastActivityAt: new Date(),
          steps: {
            create: steps.map((step, index) => ({
              name: step.name,
              state: 'NOT_STARTED' as const,
              sortOrder: index,
            })),
          },
        },
      })
    })

    revalidatePath(`/hobbies/${hobbyId}`)
    revalidatePath('/')
    return { success: true, data: { id: project.id, hobbyId } }
  } catch (error: unknown) {
    console.error('createProject failed:', error)
    if (error instanceof Error && error.message === 'HOBBY_NOT_FOUND') {
      return { success: false, error: 'Hobby not found' }
    }
    return { success: false, error: 'Failed to create project. Please try again.' }
  }
}
