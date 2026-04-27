'use server'

import { z } from 'zod/v4'
import { prisma } from '@/lib/db'
import {
  addIdeaImageSchema,
  type AddIdeaImageInput,
  addIdeaImageLinkSchema,
  type AddIdeaImageLinkInput,
} from '@/lib/schemas/idea-image'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

export interface IdeaImageWithDisplayUrl {
  id: string
  ideaId: string
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

function revalidateIdeaPaths(hobbyId?: string | null) {
  revalidatePath('/ideas')
  revalidatePath('/projects')
  if (hobbyId) revalidatePath(`/hobbies/${hobbyId}/ideas`)
}

export async function getIdeaImage(
  ideaId: string,
): Promise<ActionResult<{ image: IdeaImageWithDisplayUrl | null }>> {
  const parsed = z.uuid().safeParse(ideaId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid idea ID.' }
  }

  try {
    const image = await prisma.ideaImage.findUnique({
      where: { ideaId: parsed.data },
    })

    if (!image) {
      return { success: true, data: { image: null } }
    }

    const adapter = getImageStorageAdapter()
    const fallbackUrl = image.url ?? ''
    const isUpload = image.type === 'UPLOAD' && image.storageKey && adapter
    const withDisplayUrl: IdeaImageWithDisplayUrl = {
      id: image.id,
      ideaId: image.ideaId,
      type: image.type as 'UPLOAD' | 'LINK',
      storageKey: image.storageKey,
      url: image.url,
      originalFilename: image.originalFilename,
      contentType: image.contentType,
      sizeBytes: image.sizeBytes,
      createdAt: image.createdAt,
      displayUrl: isUpload ? adapter.getPublicUrl(image.storageKey!) : fallbackUrl,
      thumbnailUrl: isUpload
        ? adapter.getThumbnailUrl(image.storageKey!, THUMBNAIL_WIDTH.INVENTORY_CARD)
        : fallbackUrl,
    }

    return { success: true, data: { image: withDisplayUrl } }
  } catch (error) {
    console.error('getIdeaImage failed:', error)
    return { success: false, error: 'Failed to load image.' }
  }
}

/**
 * Replace-on-add: deletes any existing IdeaImage (storage + DB) before creating
 * the new one inside the same transaction. Enforces single-photo-per-idea.
 */
async function replaceIdeaImage(
  ideaId: string,
  newRow: {
    storageKey: string | null
    url: string | null
    originalFilename: string | null
    contentType: string | null
    sizeBytes: number | null
    type: 'UPLOAD' | 'LINK'
  },
): Promise<{ id: string; previousStorageKey: string | null; hobbyId: string }> {
  return prisma.$transaction(async (tx) => {
    const idea = await tx.idea.findUnique({
      where: { id: ideaId },
      select: { hobbyId: true },
    })
    if (!idea) throw new Error('IDEA_NOT_FOUND')

    const existing = await tx.ideaImage.findUnique({
      where: { ideaId },
      select: { storageKey: true, type: true },
    })
    let previousStorageKey: string | null = null
    if (existing) {
      if (existing.type === 'UPLOAD' && existing.storageKey) {
        previousStorageKey = existing.storageKey
      }
      await tx.ideaImage.delete({ where: { ideaId } })
    }

    const created = await tx.ideaImage.create({
      data: {
        ideaId,
        storageKey: newRow.storageKey,
        url: newRow.url,
        originalFilename: newRow.originalFilename,
        contentType: newRow.contentType,
        sizeBytes: newRow.sizeBytes,
        type: newRow.type,
      },
    })

    return { id: created.id, previousStorageKey, hobbyId: idea.hobbyId }
  })
}

export async function addIdeaImage(
  input: AddIdeaImageInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addIdeaImageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  let dbSuccess = false
  try {
    const result = await replaceIdeaImage(parsed.data.ideaId, {
      storageKey: parsed.data.storageKey,
      url: null,
      originalFilename: parsed.data.originalFilename,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
      type: 'UPLOAD',
    })
    dbSuccess = true

    // Best-effort: clean up the previous storage object after successful replace
    if (result.previousStorageKey) {
      try {
        const adapter = getImageStorageAdapter()
        if (adapter) await adapter.deleteObject(result.previousStorageKey)
      } catch (cleanupErr) {
        console.error('Failed to clean up replaced upload:', cleanupErr)
      }
    }

    revalidateIdeaPaths(result.hobbyId)
    return { success: true, data: { id: result.id } }
  } catch (error) {
    if (!dbSuccess) {
      try {
        const adapter = getImageStorageAdapter()
        if (adapter) await adapter.deleteObject(parsed.data.storageKey)
      } catch (cleanupErr) {
        console.error('Failed to clean up orphaned upload:', cleanupErr)
      }
    }

    console.error('addIdeaImage failed:', error)
    if (error instanceof Error && error.message === 'IDEA_NOT_FOUND') {
      return { success: false, error: 'Idea not found.' }
    }
    return { success: false, error: 'Failed to add image. Please try again.' }
  }
}

export async function addIdeaImageLink(
  input: AddIdeaImageLinkInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addIdeaImageLinkSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const result = await replaceIdeaImage(parsed.data.ideaId, {
      storageKey: null,
      url: parsed.data.url,
      originalFilename: null,
      contentType: null,
      sizeBytes: null,
      type: 'LINK',
    })

    if (result.previousStorageKey) {
      try {
        const adapter = getImageStorageAdapter()
        if (adapter) await adapter.deleteObject(result.previousStorageKey)
      } catch (cleanupErr) {
        console.error('Failed to clean up replaced upload:', cleanupErr)
      }
    }

    revalidateIdeaPaths(result.hobbyId)
    return { success: true, data: { id: result.id } }
  } catch (error) {
    console.error('addIdeaImageLink failed:', error)
    if (error instanceof Error && error.message === 'IDEA_NOT_FOUND') {
      return { success: false, error: 'Idea not found.' }
    }
    return { success: false, error: 'Failed to add image link.' }
  }
}

export async function uploadIdeaImageCloudinary(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ideaId = formData.get('ideaId') as string | null
  const file = formData.get('file') as File | null

  if (!ideaId || !file) {
    return { success: false, error: 'Missing ideaId or file.' }
  }

  const parsedId = z.uuid().safeParse(ideaId)
  if (!parsedId.success) {
    return { success: false, error: 'Invalid idea ID.' }
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
    const key = `ideas/${ideaId}/${crypto.randomUUID()}.${ext}`

    const uploadResult = await adapter.upload(buffer, key, file.type)

    let dbSuccess = false
    try {
      const result = await replaceIdeaImage(parsedId.data, {
        storageKey: uploadResult.storageKey,
        url: uploadResult.publicUrl,
        originalFilename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        type: 'UPLOAD',
      })
      dbSuccess = true

      if (result.previousStorageKey) {
        try {
          await adapter.deleteObject(result.previousStorageKey)
        } catch (cleanupErr) {
          console.error('Failed to clean up replaced upload:', cleanupErr)
        }
      }

      revalidateIdeaPaths(result.hobbyId)
      return { success: true, data: { id: result.id } }
    } catch (error) {
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
    console.error('uploadIdeaImageCloudinary failed:', error)
    if (error instanceof Error && error.message === 'IDEA_NOT_FOUND') {
      return { success: false, error: 'Idea not found.' }
    }
    return { success: false, error: 'Failed to upload image. Please try again.' }
  }
}

export async function deleteIdeaImage(ideaId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(ideaId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid idea ID.' }
  }

  try {
    const image = await prisma.ideaImage.findUnique({
      where: { ideaId: parsed.data },
      select: {
        type: true,
        storageKey: true,
        idea: { select: { hobbyId: true } },
      },
    })

    if (!image) {
      return { success: false, error: 'Image not found.' }
    }

    await prisma.ideaImage.delete({ where: { ideaId: parsed.data } })

    if (image.type === 'UPLOAD' && image.storageKey) {
      try {
        const adapter = getImageStorageAdapter()
        if (adapter) await adapter.deleteObject(image.storageKey)
      } catch (err) {
        console.error('Storage deletion failed (continuing):', err)
      }
    }

    revalidateIdeaPaths(image.idea.hobbyId)
    return { success: true, data: null }
  } catch (error) {
    console.error('deleteIdeaImage failed:', error)
    return { success: false, error: 'Failed to delete image.' }
  }
}
