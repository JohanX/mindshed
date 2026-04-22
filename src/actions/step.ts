'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import {
  createStepSchema,
  updateStepSchema,
  updateStepStateSchema,
  reorderStepsSchema,
  type CreateStepInput,
  type UpdateStepInput,
  type UpdateStepStateInput,
  type ReorderStepsInput,
} from '@/lib/schemas/step'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

async function updateProjectActivity(projectId: string) {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { lastActivityAt: new Date() },
    select: { hobbyId: true },
  })
  revalidatePath(`/hobbies/${project.hobbyId}/projects/${projectId}`)
  revalidatePath(`/hobbies/${project.hobbyId}`)
  revalidatePath('/projects')
  revalidatePath('/')
}

export async function createStep(input: CreateStepInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createStepSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const step = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: parsed.data.projectId },
        select: { isCompleted: true },
      })
      if (!project) throw new Error('PROJECT_NOT_FOUND')
      if (project.isCompleted) throw new Error('PROJECT_COMPLETED')

      const maxSort = await tx.step.aggregate({
        where: { projectId: parsed.data.projectId },
        _max: { sortOrder: true },
      })

      return tx.step.create({
        data: {
          name: parsed.data.name,
          projectId: parsed.data.projectId,
          state: 'NOT_STARTED',
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      })
    })

    await updateProjectActivity(parsed.data.projectId)
    return { success: true, data: { id: step.id } }
  } catch (error) {
    console.error('createStep failed:', error)
    if (error instanceof Error) {
      if (error.message === 'PROJECT_NOT_FOUND')
        return { success: false, error: 'Project not found.' }
      if (error.message === 'PROJECT_COMPLETED')
        return { success: false, error: 'Cannot add steps to a completed project.' }
    }
    return { success: false, error: 'Failed to add step.' }
  }
}

export async function updateStep(input: UpdateStepInput): Promise<ActionResult<{ id: string }>> {
  const parsed = updateStepSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const step = await prisma.$transaction(async (tx) => {
      const existing = await tx.step.findUniqueOrThrow({
        where: { id: parsed.data.id },
        select: { project: { select: { isCompleted: true } } },
      })
      if (existing.project.isCompleted) throw new Error('PROJECT_COMPLETED')
      return tx.step.update({ where: { id: parsed.data.id }, data: { name: parsed.data.name } })
    })

    await updateProjectActivity(step.projectId)
    return { success: true, data: { id: step.id } }
  } catch (error: unknown) {
    console.error('updateStep failed:', error)
    if (error instanceof Error && error.message === 'PROJECT_COMPLETED') {
      return { success: false, error: 'Cannot modify steps on a completed project.' }
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Step not found.' }
    }
    return { success: false, error: 'Failed to update step.' }
  }
}

export async function deleteStep(id: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) {
    return { success: false, error: 'Invalid step ID' }
  }

  try {
    const step = await prisma.$transaction(async (tx) => {
      const existing = await tx.step.findUniqueOrThrow({
        where: { id: parsed.data },
        select: { projectId: true, project: { select: { isCompleted: true } } },
      })
      if (existing.project.isCompleted) throw new Error('PROJECT_COMPLETED')
      return tx.step.delete({ where: { id: parsed.data } })
    })

    await updateProjectActivity(step.projectId)
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('deleteStep failed:', error)
    if (error instanceof Error && error.message === 'PROJECT_COMPLETED') {
      return { success: false, error: 'Cannot modify steps on a completed project.' }
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Step not found.' }
    }
    return { success: false, error: 'Failed to delete step.' }
  }
}

export async function updateStepState(input: UpdateStepStateInput): Promise<ActionResult<null>> {
  const parsed = updateStepStateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const step = await prisma.$transaction(async (tx) => {
      const existing = await tx.step.findUniqueOrThrow({
        where: { id: parsed.data.id },
        select: {
          state: true,
          previousState: true,
          projectId: true,
          project: { select: { isCompleted: true } },
        },
      })
      if (existing.project.isCompleted) throw new Error('PROJECT_COMPLETED')

      const newState = parsed.data.state

      // No-op: same state selected — just return existing step unchanged
      if (newState === existing.state) {
        return tx.step.findUniqueOrThrow({ where: { id: parsed.data.id } })
      }

      let updatedStep

      // Transitioning TO BLOCKED: save current state so it can be restored later
      if (newState === 'BLOCKED') {
        updatedStep = await tx.step.update({
          where: { id: parsed.data.id },
          data: { state: 'BLOCKED', previousState: existing.state },
        })
      } else if (existing.state === 'BLOCKED') {
        // Transitioning FROM BLOCKED: restore previousState if available
        const restoredState = existing.previousState ?? newState
        updatedStep = await tx.step.update({
          where: { id: parsed.data.id },
          data: { state: restoredState, previousState: null },
        })
      } else {
        // All other transitions: update state, clear previousState
        updatedStep = await tx.step.update({
          where: { id: parsed.data.id },
          data: { state: newState, previousState: null },
        })
      }

      // Sync project.isCompleted for query optimization
      const allSteps = await tx.step.findMany({
        where: { projectId: existing.projectId },
        select: { state: true },
      })
      const allCompleted =
        allSteps.length > 0 && allSteps.every((step) => step.state === 'COMPLETED')
      if (allCompleted !== existing.project.isCompleted) {
        await tx.project.update({
          where: { id: existing.projectId },
          data: { isCompleted: allCompleted },
        })
      }

      return updatedStep
    })

    await updateProjectActivity(step.projectId)
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('updateStepState failed:', error)
    if (error instanceof Error && error.message === 'PROJECT_COMPLETED') {
      return { success: false, error: 'Cannot modify steps on a completed project.' }
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Step not found.' }
    }
    return { success: false, error: 'Failed to update step state.' }
  }
}

export async function reorderSteps(input: ReorderStepsInput): Promise<ActionResult<null>> {
  const parsed = reorderStepsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: parsed.data.projectId },
        select: { isCompleted: true },
      })
      if (!project) throw new Error('PROJECT_NOT_FOUND')
      if (project.isCompleted) throw new Error('PROJECT_COMPLETED')

      // Verify all step IDs belong to this project
      const steps = await tx.step.findMany({
        where: { projectId: parsed.data.projectId },
        select: { id: true },
      })
      const projectStepIds = new Set(steps.map((step) => step.id))
      if (parsed.data.orderedStepIds.length !== projectStepIds.size) {
        throw new Error('STEP_COUNT_MISMATCH')
      }
      for (const id of parsed.data.orderedStepIds) {
        if (!projectStepIds.has(id)) throw new Error('STEP_NOT_IN_PROJECT')
      }

      // Update sort orders
      for (let i = 0; i < parsed.data.orderedStepIds.length; i++) {
        await tx.step.update({
          where: { id: parsed.data.orderedStepIds[i] },
          data: { sortOrder: i },
        })
      }
    })

    await updateProjectActivity(parsed.data.projectId)
    return { success: true, data: null }
  } catch (error) {
    console.error('reorderSteps failed:', error)
    if (error instanceof Error) {
      if (error.message === 'PROJECT_NOT_FOUND')
        return { success: false, error: 'Project not found.' }
      if (error.message === 'PROJECT_COMPLETED')
        return { success: false, error: 'Cannot reorder steps in a completed project.' }
      if (error.message === 'STEP_COUNT_MISMATCH')
        return { success: false, error: 'Step count does not match project.' }
      if (error.message === 'STEP_NOT_IN_PROJECT')
        return { success: false, error: 'One or more steps do not belong to this project.' }
    }
    return { success: false, error: 'Failed to reorder steps. Please try again.' }
  }
}
