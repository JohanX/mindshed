'use server'

import { z } from 'zod/v4'
import { prisma } from '@/lib/db'
import {
  addImageLinkSchema,
  type AddImageLinkInput,
  addStepImageSchema,
  type AddStepImageInput,
} from '@/lib/schemas/image'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

export interface StepImageWithDisplayUrl {
  id: string
  stepId: string
  type: 'UPLOAD' | 'LINK'
  storageKey: string | null
  url: string | null
  originalFilename: string | null
  contentType: string | null
  sizeBytes: number | null
  createdAt: Date
  displayUrl: string
  thumbnailUrl: string
}

const stepIdSchema = z.object({ stepId: z.uuid() })

export async function getStepImages(
  stepId: string,
): Promise<ActionResult<{ images: StepImageWithDisplayUrl[] }>> {
  const parsed = stepIdSchema.safeParse({ stepId })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid step ID' }
  }

  try {
    const images = await prisma.stepImage.findMany({
      where: { stepId: parsed.data.stepId },
      orderBy: { createdAt: 'desc' },
    })

    const adapter = getImageStorageAdapter()
    const fallbackUrl = (img: { url: string | null }) => img.url ?? ''
    const withDisplayUrl: StepImageWithDisplayUrl[] = images.map((img) => {
      const isUpload = img.type === 'UPLOAD' && img.storageKey && adapter
      return {
        id: img.id,
        stepId: img.stepId,
        type: img.type as 'UPLOAD' | 'LINK',
        storageKey: img.storageKey,
        url: img.url,
        originalFilename: img.originalFilename,
        contentType: img.contentType,
        sizeBytes: img.sizeBytes,
        createdAt: img.createdAt,
        displayUrl: isUpload ? adapter.getPublicUrl(img.storageKey!) : fallbackUrl(img),
        thumbnailUrl: isUpload ? adapter.getThumbnailUrl(img.storageKey!, THUMBNAIL_WIDTH.GRID) : fallbackUrl(img),
      }
    })

    return { success: true, data: { images: withDisplayUrl } }
  } catch (error) {
    console.error('getStepImages failed:', error)
    return { success: false, error: 'Failed to load images.' }
  }
}

export async function addStepImageLink(
  input: AddImageLinkInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addImageLinkSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const { image, hobbyId, projectId } = await prisma.$transaction(async (tx) => {
      const step = await tx.step.findUnique({
        where: { id: parsed.data.stepId },
        select: { projectId: true, project: { select: { id: true, hobbyId: true, isCompleted: true } } },
      })
      if (!step) throw new Error('STEP_NOT_FOUND')
      if (step.project.isCompleted) throw new Error('PROJECT_COMPLETED')

      const created = await tx.stepImage.create({
        data: { stepId: parsed.data.stepId, type: 'LINK', url: parsed.data.url, storageKey: null },
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
    console.error('addStepImageLink failed:', error)
    if (error instanceof Error) {
      if (error.message === 'STEP_NOT_FOUND') return { success: false, error: 'Step not found.' }
      if (error.message === 'PROJECT_COMPLETED') return { success: false, error: 'Cannot add images to a completed project.' }
    }
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

  let dbSuccess = false
  try {
    const { image, hobbyId, projectId } = await prisma.$transaction(async (tx) => {
      const step = await tx.step.findUnique({
        where: { id: parsed.data.stepId },
        select: { projectId: true, project: { select: { id: true, hobbyId: true, isCompleted: true } } },
      })
      if (!step) throw new Error('STEP_NOT_FOUND')
      if (step.project.isCompleted) throw new Error('PROJECT_COMPLETED')

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

    dbSuccess = true

    revalidatePath(`/hobbies/${hobbyId}/projects/${projectId}`)
    revalidatePath(`/hobbies/${hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')

    return { success: true, data: { id: image.id } }
  } catch (error) {
    // Storage orphan cleanup — client already PUT the blob via presigned URL
    // before calling this action. If the DB insert failed (validation, race
    // with project deletion, etc.), the object sits orphaned in S3/R2/MinIO.
    // Mirror the cleanup done in uploadImageCloudinary (see below).
    if (!dbSuccess) {
      try {
        const adapter = getImageStorageAdapter()
        if (adapter) {
          await adapter.deleteObject(parsed.data.storageKey)
        }
      } catch (cleanupErr) {
        console.error('Failed to clean up orphaned upload:', cleanupErr)
      }
    }

    console.error('addStepImage failed:', error)
    if (error instanceof Error) {
      if (error.message === 'STEP_NOT_FOUND') return { success: false, error: 'Step not found.' }
      if (error.message === 'PROJECT_COMPLETED') return { success: false, error: 'Cannot add images to a completed project.' }
    }
    return { success: false, error: 'Failed to add image. Please try again.' }
  }
}

export async function uploadImageCloudinary(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const stepId = formData.get('stepId') as string | null
  const file = formData.get('file') as File | null

  if (!stepId || !file) {
    return { success: false, error: 'Missing stepId or file.' }
  }

  const parsedStepId = z.uuid().safeParse(stepId)
  if (!parsedStepId.success) {
    return { success: false, error: 'Invalid step ID.' }
  }

  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { success: false, error: 'Only JPEG, PNG, and WebP images are allowed.' }
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { success: false, error: 'Image must be under 10 MB.' }
  }

  const adapter = getImageStorageAdapter()
  if (!adapter) {
    return { success: false, error: 'Image storage is not configured.' }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.type.split('/')[1] || 'jpg'
    const key = `steps/${stepId}/${crypto.randomUUID()}.${ext}`

    const uploadResult = await adapter.upload(buffer, key, file.type)

    let dbSuccess = false
    try {
      const { image, hobbyId, projectId } = await prisma.$transaction(async (tx) => {
        const step = await tx.step.findUnique({
          where: { id: parsedStepId.data },
          select: { projectId: true, project: { select: { id: true, hobbyId: true, isCompleted: true } } },
        })
        if (!step) throw new Error('STEP_NOT_FOUND')
        if (step.project.isCompleted) throw new Error('PROJECT_COMPLETED')

        const created = await tx.stepImage.create({
          data: {
            stepId: parsedStepId.data,
            storageKey: uploadResult.storageKey,
            url: uploadResult.publicUrl,
            originalFilename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            type: 'UPLOAD',
          },
        })

        await tx.project.update({
          where: { id: step.projectId },
          data: { lastActivityAt: new Date() },
        })

        return { image: created, hobbyId: step.project.hobbyId, projectId: step.projectId }
      })

      dbSuccess = true

      revalidatePath(`/hobbies/${hobbyId}/projects/${projectId}`)
      revalidatePath(`/hobbies/${hobbyId}`)
      revalidatePath('/projects')
      revalidatePath('/')

      return { success: true, data: { id: image.id } }
    } catch (error) {
      // Clean up orphaned upload if DB transaction failed
      if (!dbSuccess) {
        try {
          await adapter.deleteObject(uploadResult.storageKey)
        } catch (cleanupErr) {
          console.error('Failed to clean up orphaned upload:', cleanupErr)
        }
      }
      throw error
    }
  } catch (error) {
    console.error('uploadImageCloudinary failed:', error)
    if (error instanceof Error) {
      if (error.message === 'STEP_NOT_FOUND') return { success: false, error: 'Step not found.' }
      if (error.message === 'PROJECT_COMPLETED') return { success: false, error: 'Cannot add images to a completed project.' }
    }
    return { success: false, error: 'Failed to upload image. Please try again.' }
  }
}

export async function deleteStepImage(imageId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(imageId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid image ID.' }
  }

  try {
    const image = await prisma.stepImage.findUnique({
      where: { id: parsed.data },
      select: {
        id: true,
        type: true,
        storageKey: true,
        step: {
          select: {
            projectId: true,
            project: { select: { hobbyId: true } },
          },
        },
      },
    })

    if (!image) {
      return { success: false, error: 'Image not found.' }
    }

    // Best-effort storage deletion for uploaded images
    if (image.type === 'UPLOAD' && image.storageKey) {
      try {
        const adapter = getImageStorageAdapter()
        if (adapter) {
          await adapter.deleteObject(image.storageKey)
        }
      } catch (err) {
        console.error('Storage deletion failed (continuing):', err)
      }
    }

    await prisma.stepImage.delete({ where: { id: parsed.data } })

    await prisma.project.update({
      where: { id: image.step.projectId },
      data: { lastActivityAt: new Date() },
    })

    const hobbyId = image.step.project.hobbyId
    const projectId = image.step.projectId

    revalidatePath(`/hobbies/${hobbyId}/projects/${projectId}`)
    revalidatePath(`/hobbies/${hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')

    return { success: true, data: null }
  } catch (error) {
    console.error('deleteStepImage failed:', error)
    return { success: false, error: 'Failed to delete image.' }
  }
}
