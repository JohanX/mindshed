'use server'

import { prisma } from '@/lib/db'
import { createBlockerSchema, type CreateBlockerInput, resolveBlockerSchema, type ResolveBlockerInput, type BlockerWithContext } from '@/lib/schemas/blocker'
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

export async function resolveBlocker(
  input: ResolveBlockerInput,
): Promise<ActionResult<{ id: string; description: string; isResolved: boolean }>> {
  const parsed = resolveBlockerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const blocker = await tx.blocker.findUnique({
        where: { id: parsed.data.blockerId },
        select: {
          id: true,
          description: true,
          stepId: true,
          step: {
            select: { id: true, previousState: true, projectId: true },
          },
        },
      })
      if (!blocker) throw new Error('BLOCKER_NOT_FOUND')

      // Mark blocker as resolved
      const updatedBlocker = await tx.blocker.update({
        where: { id: blocker.id },
        data: { isResolved: true },
      })

      // Count remaining unresolved blockers on the same step (excluding this one)
      const unresolvedCount = await tx.blocker.count({
        where: {
          stepId: blocker.stepId,
          isResolved: false,
          id: { not: blocker.id },
        },
      })

      // If this was the last unresolved blocker, revert step state
      if (unresolvedCount === 0) {
        await tx.step.update({
          where: { id: blocker.step.id },
          data: {
            state: blocker.step.previousState ?? 'NOT_STARTED',
            previousState: null,
          },
        })
      }
      // If count > 0, step stays BLOCKED — no update needed

      // Update project lastActivityAt
      const project = await tx.project.update({
        where: { id: blocker.step.projectId },
        data: { lastActivityAt: new Date() },
        select: { hobbyId: true },
      })

      return {
        blocker: updatedBlocker,
        projectId: blocker.step.projectId,
        hobbyId: project.hobbyId,
      }
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
    console.error('resolveBlocker failed:', error)
    if (error instanceof Error) {
      if (error.message === 'BLOCKER_NOT_FOUND') return { success: false, error: 'Blocker not found.' }
    }
    return { success: false, error: 'Failed to resolve blocker.' }
  }
}

export async function getActiveBlockers(): Promise<ActionResult<BlockerWithContext[]>> {
  try {
    const blockers = await prisma.blocker.findMany({
      where: { isResolved: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        description: true,
        isResolved: true,
        createdAt: true,
        step: {
          select: {
            name: true,
            project: {
              select: {
                id: true,
                name: true,
                hobbyId: true,
                hobby: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                    icon: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return { success: true, data: blockers }
  } catch (error) {
    console.error('getActiveBlockers failed:', error)
    return { success: false, error: 'Failed to load active blockers.' }
  }
}
