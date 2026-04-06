'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import { createStepSchema, updateStepSchema, updateStepStateSchema, type CreateStepInput, type UpdateStepInput, type UpdateStepStateInput } from '@/lib/schemas/step'
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
      if (error.message === 'PROJECT_NOT_FOUND') return { success: false, error: 'Project not found.' }
      if (error.message === 'PROJECT_COMPLETED') return { success: false, error: 'Cannot add steps to a completed project.' }
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
    const step = await prisma.step.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name },
    })

    await updateProjectActivity(step.projectId)
    return { success: true, data: { id: step.id } }
  } catch (error: unknown) {
    console.error('updateStep failed:', error)
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
    const step = await prisma.step.delete({
      where: { id: parsed.data },
    })

    await updateProjectActivity(step.projectId)
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('deleteStep failed:', error)
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
    const step = await prisma.step.update({
      where: { id: parsed.data.id },
      data: { state: parsed.data.state },
    })

    await updateProjectActivity(step.projectId)
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('updateStepState failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Step not found.' }
    }
    return { success: false, error: 'Failed to update step state.' }
  }
}
