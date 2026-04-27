'use server'

import { z } from 'zod/v4'
import { prisma } from '@/lib/db'
import {
  createBlockerSchema,
  type CreateBlockerInput,
  resolveBlockerSchema,
  type ResolveBlockerInput,
  updateBlockerSchema,
  type UpdateBlockerInput,
  type BlockerWithContext,
} from '@/lib/schemas/blocker'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import { findActiveBlockers } from '@/data/blocker'

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
        select: {
          id: true,
          state: true,
          previousState: true,
          projectId: true,
          project: { select: { isCompleted: true } },
        },
      })
      if (!step) throw new Error('STEP_NOT_FOUND')
      if (step.project.isCompleted) throw new Error('PROJECT_COMPLETED')
      if (step.state === 'COMPLETED') throw new Error('STEP_COMPLETED')

      // Validate optional inventory item link
      if (parsed.data.inventoryItemId) {
        const item = await tx.inventoryItem.findUnique({
          where: { id: parsed.data.inventoryItemId },
        })
        if (!item) throw new Error('INVENTORY_ITEM_NOT_FOUND')
      }

      const blocker = await tx.blocker.create({
        data: {
          stepId: parsed.data.stepId,
          description: parsed.data.description,
          inventoryItemId: parsed.data.inventoryItemId ?? null,
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
      if (error.message === 'PROJECT_COMPLETED')
        return { success: false, error: 'Cannot add blockers to a completed project.' }
      if (error.message === 'STEP_COMPLETED')
        return { success: false, error: 'Cannot block a completed step.' }
      if (error.message === 'INVENTORY_ITEM_NOT_FOUND')
        return { success: false, error: 'Linked inventory item not found.' }
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
            state:
              blocker.step.previousState === 'COMPLETED'
                ? 'IN_PROGRESS'
                : (blocker.step.previousState ?? 'NOT_STARTED'),
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
      if (error.message === 'BLOCKER_NOT_FOUND')
        return { success: false, error: 'Blocker not found.' }
    }
    return { success: false, error: 'Failed to resolve blocker.' }
  }
}

export async function updateBlocker(
  input: UpdateBlockerInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateBlockerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updateData: { description: string; inventoryItemId?: string | null } = {
        description: parsed.data.description,
      }
      if (parsed.data.inventoryItemId !== undefined) {
        updateData.inventoryItemId = parsed.data.inventoryItemId
      }
      const blocker = await tx.blocker.update({
        where: { id: parsed.data.id },
        data: updateData,
        select: {
          id: true,
          step: { select: { projectId: true, project: { select: { hobbyId: true } } } },
        },
      })

      await tx.project.update({
        where: { id: blocker.step.projectId },
        data: { lastActivityAt: new Date() },
      })

      return {
        id: blocker.id,
        hobbyId: blocker.step.project.hobbyId,
        projectId: blocker.step.projectId,
      }
    })

    revalidatePath(`/hobbies/${result.hobbyId}/projects/${result.projectId}`)
    revalidatePath('/')

    return { success: true, data: { id: result.id } }
  } catch (error) {
    console.error('updateBlocker failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Blocker not found.' }
    }
    return { success: false, error: 'Failed to update blocker.' }
  }
}

export async function deleteBlocker(blockerId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(blockerId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid blocker ID.' }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const blocker = await tx.blocker.findUnique({
        where: { id: parsed.data },
        select: {
          id: true,
          isResolved: true,
          stepId: true,
          step: { select: { id: true, previousState: true, projectId: true } },
        },
      })
      if (!blocker) throw new Error('BLOCKER_NOT_FOUND')

      await tx.blocker.delete({ where: { id: parsed.data } })

      // If blocker was unresolved, check if step should revert from BLOCKED
      if (!blocker.isResolved) {
        const unresolvedCount = await tx.blocker.count({
          where: { stepId: blocker.stepId, isResolved: false },
        })
        if (unresolvedCount === 0) {
          await tx.step.update({
            where: { id: blocker.step.id },
            data: {
              state:
                blocker.step.previousState === 'COMPLETED'
                  ? 'IN_PROGRESS'
                  : (blocker.step.previousState ?? 'NOT_STARTED'),
              previousState: null,
            },
          })
        }
      }

      const project = await tx.project.update({
        where: { id: blocker.step.projectId },
        data: { lastActivityAt: new Date() },
        select: { hobbyId: true },
      })

      return { projectId: blocker.step.projectId, hobbyId: project.hobbyId }
    })

    revalidatePath(`/hobbies/${result.hobbyId}/projects/${result.projectId}`)
    revalidatePath('/')

    return { success: true, data: null }
  } catch (error) {
    console.error('deleteBlocker failed:', error)
    if (error instanceof Error && error.message === 'BLOCKER_NOT_FOUND') {
      return { success: false, error: 'Blocker not found.' }
    }
    return { success: false, error: 'Failed to delete blocker.' }
  }
}

export async function getActiveBlockers(): Promise<ActionResult<BlockerWithContext[]>> {
  try {
    const data = await findActiveBlockers()
    return { success: true, data }
  } catch (error) {
    console.error('getActiveBlockers failed:', error)
    return { success: false, error: 'Failed to load active blockers.' }
  }
}
