'use server'

import { z } from 'zod/v4'
import { prisma } from '@/lib/db'
import {
  addInventoryItemImageSchema,
  type AddInventoryItemImageInput,
  addInventoryItemImageLinkSchema,
  type AddInventoryItemImageLinkInput,
} from '@/lib/schemas/inventory-image'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import {
  findInventoryItemImagesWithDisplayUrl,
  type InventoryItemImageWithDisplayUrl,
} from '@/data/inventory-image'
import { findDistinctProjectsForInventoryItem } from '@/data/bom'

// Re-export type for existing callers; new ones should import from '@/data/inventory-image'.
export type { InventoryItemImageWithDisplayUrl } from '@/data/inventory-image'

async function revalidateBomProjectPaths(inventoryItemId: string) {
  const projects = await findDistinctProjectsForInventoryItem(inventoryItemId)
  for (const project of projects) {
    revalidatePath(`/hobbies/${project.hobbyId}/projects/${project.id}`)
  }
}

export async function getInventoryItemImages(
  inventoryItemId: string,
): Promise<ActionResult<{ images: InventoryItemImageWithDisplayUrl[] }>> {
  const parsed = z.uuid().safeParse(inventoryItemId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid inventory item ID.' }
  }

  try {
    const images = await findInventoryItemImagesWithDisplayUrl(parsed.data)
    return { success: true, data: { images } }
  } catch (error) {
    console.error('getInventoryItemImages failed:', error)
    return { success: false, error: 'Failed to load images.' }
  }
}

export async function addInventoryItemImage(
  input: AddInventoryItemImageInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addInventoryItemImageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  let dbSuccess = false
  try {
    const image = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({
        where: { id: parsed.data.inventoryItemId },
        select: { isDeleted: true },
      })
      if (!item) throw new Error('ITEM_NOT_FOUND')
      if (item.isDeleted) throw new Error('ITEM_DELETED')

      return tx.inventoryItemImage.create({
        data: {
          inventoryItemId: parsed.data.inventoryItemId,
          storageKey: parsed.data.storageKey,
          originalFilename: parsed.data.originalFilename,
          contentType: parsed.data.contentType,
          sizeBytes: parsed.data.sizeBytes,
          type: 'UPLOAD',
        },
      })
    })

    dbSuccess = true
    revalidatePath('/inventory')
    await revalidateBomProjectPaths(parsed.data.inventoryItemId)
    return { success: true, data: { id: image.id } }
  } catch (error) {
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

    console.error('addInventoryItemImage failed:', error)
    if (error instanceof Error) {
      if (error.message === 'ITEM_NOT_FOUND') return { success: false, error: 'Item not found.' }
      if (error.message === 'ITEM_DELETED')
        return { success: false, error: 'Item has been deleted.' }
    }
    return { success: false, error: 'Failed to add image. Please try again.' }
  }
}

export async function addInventoryItemImageLink(
  input: AddInventoryItemImageLinkInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addInventoryItemImageLinkSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const image = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({
        where: { id: parsed.data.inventoryItemId },
        select: { isDeleted: true },
      })
      if (!item) throw new Error('ITEM_NOT_FOUND')
      if (item.isDeleted) throw new Error('ITEM_DELETED')

      return tx.inventoryItemImage.create({
        data: {
          inventoryItemId: parsed.data.inventoryItemId,
          type: 'LINK',
          url: parsed.data.url,
          storageKey: null,
        },
      })
    })

    revalidatePath('/inventory')
    await revalidateBomProjectPaths(parsed.data.inventoryItemId)
    return { success: true, data: { id: image.id } }
  } catch (error) {
    console.error('addInventoryItemImageLink failed:', error)
    if (error instanceof Error) {
      if (error.message === 'ITEM_NOT_FOUND') return { success: false, error: 'Item not found.' }
      if (error.message === 'ITEM_DELETED')
        return { success: false, error: 'Item has been deleted.' }
    }
    return { success: false, error: 'Failed to add image link.' }
  }
}

export async function uploadInventoryItemImageCloudinary(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const inventoryItemId = formData.get('inventoryItemId') as string | null
  const file = formData.get('file') as File | null

  if (!inventoryItemId || !file) {
    return { success: false, error: 'Missing inventoryItemId or file.' }
  }

  const parsedId = z.uuid().safeParse(inventoryItemId)
  if (!parsedId.success) {
    return { success: false, error: 'Invalid inventory item ID.' }
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
    const key = `inventory/${inventoryItemId}/${crypto.randomUUID()}.${ext}`

    const uploadResult = await adapter.upload(buffer, key, file.type)

    let dbSuccess = false
    try {
      const image = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findUnique({
          where: { id: parsedId.data },
          select: { isDeleted: true },
        })
        if (!item) throw new Error('ITEM_NOT_FOUND')
        if (item.isDeleted) throw new Error('ITEM_DELETED')

        return tx.inventoryItemImage.create({
          data: {
            inventoryItemId: parsedId.data,
            storageKey: uploadResult.storageKey,
            url: uploadResult.publicUrl,
            originalFilename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            type: 'UPLOAD',
          },
        })
      })

      dbSuccess = true
      revalidatePath('/inventory')
      await revalidateBomProjectPaths(parsedId.data)
      return { success: true, data: { id: image.id } }
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
    console.error('uploadInventoryItemImageCloudinary failed:', error)
    if (error instanceof Error) {
      if (error.message === 'ITEM_NOT_FOUND') return { success: false, error: 'Item not found.' }
      if (error.message === 'ITEM_DELETED')
        return { success: false, error: 'Item has been deleted.' }
    }
    return { success: false, error: 'Failed to upload image. Please try again.' }
  }
}

export async function deleteInventoryItemImage(imageId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(imageId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid image ID.' }
  }

  try {
    const image = await prisma.inventoryItemImage.findUnique({
      where: { id: parsed.data },
      select: {
        id: true,
        inventoryItemId: true,
        type: true,
        storageKey: true,
      },
    })

    if (!image) {
      return { success: false, error: 'Image not found.' }
    }

    await prisma.inventoryItemImage.delete({ where: { id: parsed.data } })

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

    revalidatePath('/inventory')
    await revalidateBomProjectPaths(image.inventoryItemId)
    return { success: true, data: null }
  } catch (error) {
    console.error('deleteInventoryItemImage failed:', error)
    return { success: false, error: 'Failed to delete image.' }
  }
}
