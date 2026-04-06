'use server'

import { prisma } from '@/lib/db'
import { createBlockerSchema, type CreateBlockerInput } from '@/lib/schemas/blocker'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

export async function createBlocker(
  input: CreateBlockerInput,
): Promise<ActionResult<{ id: string; description: string; isResolved: boolean }>> {
  const parsed = createBlockerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const step = await tx.step.findUnique({
        where: { id: parsed.data.stepId },
        select: { id: true, state: true, previousState: true, projectId: true },
      })
      if (!step) throw new Error('STEP_NOT_FOUND')

      const blocker = await tx.blocker.create({
        data: {
          stepId: parsed.data.stepId,
          description: parsed.data.description,
        },
      })

      // If the step is not already BLOCKED, save current state and set to BLOCKED
      if (step.state !== 'BLOCKED') {
        await tx.step.update({
          where: { id: step.id },
          data: {
            previousState: step.state,
            state: 'BLOCKED',
          },
        })
      }
      // If already BLOCKED, don't overwrite previousState

      // Update parent project's lastActivityAt
      const project = await tx.project.update({
        where: { id: step.projectId },
        data: { lastActivityAt: new Date() },
        select: { hobbyId: true },
      })

      return { blocker, projectId: step.projectId, hobbyId: project.hobbyId }
    })

    revalidatePath(`/hobbies/${result.hobbyId}/projects/${result.projectId}`)
    revalidatePath(`/hobbies/${result.hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')

    return {
      success: true,
      data: {
        id: result.blocker.id,
        description: result.blocker.description,
        isResolved: result.blocker.isResolved,
      },
    }
  } catch (error) {
    console.error('createBlocker failed:', error)
    if (error instanceof Error) {
      if (error.message === 'STEP_NOT_FOUND') return { success: false, error: 'Step not found.' }
    }
    return { success: false, error: 'Failed to add blocker.' }
  }
}
