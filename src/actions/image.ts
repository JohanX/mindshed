'use server'

import { prisma } from '@/lib/db'
import {
  addImageLinkSchema,
  type AddImageLinkInput,
  addStepImageSchema,
  type AddStepImageInput,
} from '@/lib/schemas/image'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

export async function addStepImageLink(
  input: AddImageLinkInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addImageLinkSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const step = await prisma.step.findUnique({
      where: { id: parsed.data.stepId },
      select: {
        id: true,
        projectId: true,
        project: { select: { hobbyId: true, isCompleted: true } },
      },
    })

    if (!step) {
      return { success: false, error: 'Step not found.' }
    }

    if (step.project.isCompleted) {
      return { success: false, error: 'Cannot add images to a completed project.' }
    }

    const image = await prisma.stepImage.create({
      data: {
        stepId: parsed.data.stepId,
        type: 'LINK',
        url: parsed.data.url,
        storageKey: null,
      },
    })

    await prisma.project.update({
      where: { id: step.projectId },
      data: { lastActivityAt: new Date() },
    })

    revalidatePath(`/hobbies/${step.project.hobbyId}/projects/${step.projectId}`)
    revalidatePath(`/hobbies/${step.project.hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')

    return { success: true, data: { id: image.id } }
  } catch (error) {
    console.error('addStepImageLink failed:', error)
    return { success: false, error: 'Failed to add image link.' }
  }
}

export async function addStepImage(
  input: AddStepImageInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addStepImageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const { image, hobbyId, projectId } = await prisma.$transaction(async (tx) => {
      const step = await tx.step.findUnique({
        where: { id: parsed.data.stepId },
        select: { projectId: true, project: { select: { id: true, hobbyId: true } } },
      })
      if (!step) throw new Error('STEP_NOT_FOUND')

      const created = await tx.stepImage.create({
        data: {
          stepId: parsed.data.stepId,
          storageKey: parsed.data.storageKey,
          originalFilename: parsed.data.originalFilename,
          contentType: parsed.data.contentType,
          sizeBytes: parsed.data.sizeBytes,
          type: 'UPLOAD',
        },
      })

      await tx.project.update({
        where: { id: step.projectId },
        data: { lastActivityAt: new Date() },
      })

      return { image: created, hobbyId: step.project.hobbyId, projectId: step.projectId }
    })

    revalidatePath(`/hobbies/${hobbyId}/projects/${projectId}`)
    revalidatePath(`/hobbies/${hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')

    return { success: true, data: { id: image.id } }
  } catch (error) {
    console.error('addStepImage failed:', error)
    if (error instanceof Error && error.message === 'STEP_NOT_FOUND') {
      return { success: false, error: 'Step not found.' }
    }
    return { success: false, error: 'Failed to add image. Please try again.' }
  }
}
