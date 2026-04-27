/**
 * Data access layer for InventoryItemImage. Handles the gallery-shape read
 * that powers the inventory item edit dialog and lightbox.
 */

import { prisma } from '@/lib/db'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

export interface InventoryItemImageWithDisplayUrl {
  id: string
  inventoryItemId: string
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

/** Find a single image row including inventoryItemId (used by delete flow). */
export async function findInventoryItemImageById(id: string) {
  return prisma.inventoryItemImage.findUnique({
    where: { id },
    select: {
      id: true,
      inventoryItemId: true,
      type: true,
      storageKey: true,
    },
  })
}

/**
 * All images for an inventory item, with display + thumbnail URLs resolved
 * server-side per the storage-adapter-not-in-client-bundle rule.
 */
export async function findInventoryItemImagesWithDisplayUrl(
  inventoryItemId: string,
): Promise<InventoryItemImageWithDisplayUrl[]> {
  const images = await prisma.inventoryItemImage.findMany({
    where: { inventoryItemId },
    orderBy: { createdAt: 'asc' },
  })

  const adapter = getImageStorageAdapter()
  const fallback = (img: { url: string | null }) => img.url ?? ''

  return images.map((img) => {
    const isUpload = img.type === 'UPLOAD' && img.storageKey && adapter
    return {
      id: img.id,
      inventoryItemId: img.inventoryItemId,
      type: img.type as 'UPLOAD' | 'LINK',
      storageKey: img.storageKey,
      url: img.url,
      originalFilename: img.originalFilename,
      contentType: img.contentType,
      sizeBytes: img.sizeBytes,
      createdAt: img.createdAt,
      displayUrl: isUpload ? adapter.getPublicUrl(img.storageKey!) : fallback(img),
      thumbnailUrl: isUpload
        ? adapter.getThumbnailUrl(img.storageKey!, THUMBNAIL_WIDTH.GRID)
        : fallback(img),
    }
  })
}
