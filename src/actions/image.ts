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
import {
  ACCEPTED_STEP_MEDIA_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_SIZE_BYTES,
} from '@/lib/constants/image-upload'
import { IMAGE_LIMITS, stepImageLimitError } from '@/lib/constants/image-limits'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import {
  findStepImagesWithDisplayUrl,
  findStepImageWithContext,
  type StepImageWithDisplayUrl,
} from '@/data/image'

// Re-export the type so existing callers still work after the migration.
export type { StepImageWithDisplayUrl } from '@/data/image'

const stepIdSchema = z.object({ stepId: z.uuid() })

function mediaTypeForCleanup(mediaType: 'IMAGE' | 'VIDEO'): 'image' | 'video' {
  // Exhaustive on the enum — adding a third StepMediaType variant in the
  // future trips a TypeScript error here, surfacing the gap instead of
  // silently routing through Cloudinary's image pipeline (which would
  // orphan the bytes of any non-image type — exactly the FR122 bug the
  // Story 35.1 / 35.2 work is closing).
  switch (mediaType) {
    case 'VIDEO':
      return 'video'
    case 'IMAGE':
      return 'image'
  }
}

function isVideoMime(mime: string): boolean {
  return (ACCEPTED_VIDEO_TYPES as readonly string[]).includes(mime)
}

export async function getStepImages(
  stepId: string,
): Promise<ActionResult<{ images: StepImageWithDisplayUrl[] }>> {
  const parsed = stepIdSchema.safeParse({ stepId })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid step ID' }
  }

  try {
    const images = await findStepImagesWithDisplayUrl(parsed.data.stepId)
    return { success: true, data: { images } }
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
        select: {
          projectId: true,
          project: { select: { id: true, hobbyId: true, isCompleted: true } },
        },
      })
      if (!step) throw new Error('STEP_NOT_FOUND')
      if (step.project.isCompleted) throw new Error('PROJECT_COMPLETED')

      // FR117 / FR135: max IMAGE_LIMITS.step assets per step (image + video share the bucket).
      const existingCount = await tx.stepImage.count({
        where: { stepId: parsed.data.stepId },
      })
      if (existingCount >= IMAGE_LIMITS.step) throw new Error('STEP_IMAGE_LIMIT_REACHED')

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
      if (error.message === 'PROJECT_COMPLETED')
        return { success: false, error: 'Cannot add images to a completed project.' }
      if (error.message === 'STEP_IMAGE_LIMIT_REACHED')
        return { success: false, error: stepImageLimitError() }
    }
    return { success: false, error: 'Failed to add image link.' }
  }
}

export async function addStepImage(
  input: AddStepImageInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addStepImageSchema.safeParse(input)
  if (!parsed.success) {
    // Code-review (Story 35.2) HIGH finding: client has already PUT the
    // blob via presigned URL by the time this action is called. If the
    // schema rejects, the object orphans in S3/R2/Cloudinary unless we
    // clean up here too. The post-tx catch handles DB-transaction
    // failures; this branch handles validation failures.
    //
    // Best-effort: infer mediaType from the (unparsed) input. The type
    // assertion is safe because we read a field that may not exist; if
    // input.storageKey is missing/non-string we skip cleanup entirely.
    const maybeInput = input as Partial<AddStepImageInput> | undefined
    const orphanKey = typeof maybeInput?.storageKey === 'string' ? maybeInput.storageKey : null
    if (orphanKey) {
      try {
        const adapter = getImageStorageAdapter()
        if (adapter) {
          const inferred: 'image' | 'video' = maybeInput?.mediaType === 'VIDEO' ? 'video' : 'image'
          await adapter.deleteObject(orphanKey, { mediaType: inferred })
        }
      } catch (cleanupErr) {
        console.error('Failed to clean up orphaned upload after validation failure:', cleanupErr)
      }
    }
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  let dbSuccess = false
  try {
    const { image, hobbyId, projectId } = await prisma.$transaction(async (tx) => {
      const step = await tx.step.findUnique({
        where: { id: parsed.data.stepId },
        select: {
          projectId: true,
          project: { select: { id: true, hobbyId: true, isCompleted: true } },
        },
      })
      if (!step) throw new Error('STEP_NOT_FOUND')
      if (step.project.isCompleted) throw new Error('PROJECT_COMPLETED')

      // FR117 / FR135: max IMAGE_LIMITS.step assets per step (image + video share the bucket).
      const existingCount = await tx.stepImage.count({
        where: { stepId: parsed.data.stepId },
      })
      if (existingCount >= IMAGE_LIMITS.step) throw new Error('STEP_IMAGE_LIMIT_REACHED')

      const created = await tx.stepImage.create({
        data: {
          stepId: parsed.data.stepId,
          storageKey: parsed.data.storageKey,
          originalFilename: parsed.data.originalFilename,
          contentType: parsed.data.contentType,
          sizeBytes: parsed.data.sizeBytes,
          type: 'UPLOAD',
          mediaType: parsed.data.mediaType,
          durationSeconds: parsed.data.durationSeconds,
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
    //
    // Story 35.2 (closes Story 35.1 code-review HIGH defer): route mediaType
    // to adapter.deleteObject so Cloudinary destroy() uses resource_type:'video'
    // for video keys. Without this, video bytes silently orphan.
    if (!dbSuccess) {
      try {
        const adapter = getImageStorageAdapter()
        if (adapter) {
          await adapter.deleteObject(parsed.data.storageKey, {
            mediaType: mediaTypeForCleanup(parsed.data.mediaType),
          })
        }
      } catch (cleanupErr) {
        console.error('Failed to clean up orphaned upload:', cleanupErr)
      }
    }

    console.error('addStepImage failed:', error)
    if (error instanceof Error) {
      if (error.message === 'STEP_NOT_FOUND') return { success: false, error: 'Step not found.' }
      if (error.message === 'PROJECT_COMPLETED')
        return { success: false, error: 'Cannot add images to a completed project.' }
      if (error.message === 'STEP_IMAGE_LIMIT_REACHED')
        return { success: false, error: stepImageLimitError() }
    }
    return { success: false, error: 'Failed to add image. Please try again.' }
  }
}

export async function uploadImageCloudinary(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const stepId = formData.get('stepId') as string | null
  const file = formData.get('file') as File | null
  const durationSecondsRaw = formData.get('durationSeconds') as string | null

  if (!stepId || !file) {
    return { success: false, error: 'Missing stepId or file.' }
  }

  const parsedStepId = z.uuid().safeParse(stepId)
  if (!parsedStepId.success) {
    return { success: false, error: 'Invalid step ID.' }
  }

  if (!(ACCEPTED_STEP_MEDIA_TYPES as readonly string[]).includes(file.type)) {
    return {
      success: false,
      error: 'Only JPEG, PNG, WebP images and MP4 / MOV / WebM videos are allowed.',
    }
  }

  const isVideo = isVideoMime(file.type)
  const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES
  if (file.size > maxSize) {
    return {
      success: false,
      error: isVideo ? 'Video must be under 60 MB.' : 'Image must be under 10 MB.',
    }
  }

  let durationSeconds: number | null = null
  if (isVideo) {
    const parsedDuration = z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_VIDEO_DURATION_SECONDS)
      .safeParse(durationSecondsRaw)
    if (!parsedDuration.success) {
      return {
        success: false,
        error: `Video duration must be 1-${MAX_VIDEO_DURATION_SECONDS} seconds.`,
      }
    }
    durationSeconds = parsedDuration.data
  }

  const adapter = getImageStorageAdapter()
  if (!adapter) {
    return { success: false, error: 'Image storage is not configured.' }
  }

  let uploadResult: { publicUrl: string; storageKey: string } | null = null
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.type.split('/')[1] || 'jpg'
    const key = `steps/${stepId}/${crypto.randomUUID()}.${ext}`

    // Story 35.2 / FR134: pass mediaType to the adapter so Cloudinary
    // routes through resource_type:'video' for video uploads. Without
    // this, Cloudinary either rejects video bytes or transcodes them
    // incorrectly through the image pipeline.
    uploadResult = await adapter.upload(buffer, key, file.type, {
      mediaType: isVideo ? 'video' : 'image',
    })

    let dbSuccess = false
    try {
      const { image, hobbyId, projectId } = await prisma.$transaction(async (tx) => {
        const step = await tx.step.findUnique({
          where: { id: parsedStepId.data },
          select: {
            projectId: true,
            project: { select: { id: true, hobbyId: true, isCompleted: true } },
          },
        })
        if (!step) throw new Error('STEP_NOT_FOUND')
        if (step.project.isCompleted) throw new Error('PROJECT_COMPLETED')

        // FR117 / FR135: max IMAGE_LIMITS.step assets per step.
        const existingCount = await tx.stepImage.count({ where: { stepId: parsedStepId.data } })
        if (existingCount >= IMAGE_LIMITS.step) throw new Error('STEP_IMAGE_LIMIT_REACHED')

        const created = await tx.stepImage.create({
          data: {
            stepId: parsedStepId.data,
            storageKey: uploadResult!.storageKey,
            url: uploadResult!.publicUrl,
            originalFilename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            type: 'UPLOAD',
            mediaType: isVideo ? 'VIDEO' : 'IMAGE',
            durationSeconds,
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
      // Clean up orphaned upload if DB transaction failed.
      // Story 35.2 (closes Story 35.1 defer): route mediaType so Cloudinary
      // destroy() uses resource_type:'video' for video orphans.
      if (!dbSuccess && uploadResult) {
        try {
          await adapter.deleteObject(uploadResult.storageKey, {
            mediaType: isVideo ? 'video' : 'image',
          })
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
      if (error.message === 'PROJECT_COMPLETED')
        return { success: false, error: 'Cannot add images to a completed project.' }
      if (error.message === 'STEP_IMAGE_LIMIT_REACHED')
        return { success: false, error: stepImageLimitError() }
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
    const image = await findStepImageWithContext(parsed.data)

    if (!image) {
      return { success: false, error: 'Image not found.' }
    }

    // Best-effort storage deletion for uploaded images.
    //
    // Story 35.2 (closes Story 35.1 code-review HIGH defer): route mediaType
    // so Cloudinary destroy() uses resource_type:'video' for VIDEO rows.
    // Without this, Cloudinary silently returns 'not found' on video keys
    // and orphans the bytes — defeats the FR122 cascade-cleanup contract
    // at the single-item delete surface.
    if (image.type === 'UPLOAD' && image.storageKey) {
      try {
        const adapter = getImageStorageAdapter()
        if (adapter) {
          await adapter.deleteObject(image.storageKey, {
            mediaType: mediaTypeForCleanup(image.mediaType),
          })
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
