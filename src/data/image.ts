/**
 * Data access layer for StepImage. (Inventory images live in
 * `data/inventory-image.ts` per Story 24.4; idea images in
 * `data/idea-image.ts` per Story 24.3.)
 */

import { prisma } from '@/lib/db'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

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

/** Find a single step image by id, including step→project context for cleanup. */
export async function findStepImageWithContext(id: string) {
  return prisma.stepImage.findUnique({
    where: { id },
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
}

/**
 * Find all images for a step with display + thumbnail URLs resolved
 * server-side (per architecture rule — keep storage adapter out of
 * client bundles).
 */
export async function findStepImagesWithDisplayUrl(
  stepId: string,
): Promise<StepImageWithDisplayUrl[]> {
  const images = await prisma.stepImage.findMany({
    where: { stepId },
    orderBy: { createdAt: 'desc' },
  })

  const adapter = getImageStorageAdapter()
  const fallback = (img: { url: string | null }) => img.url ?? ''

  return images.map((img) => {
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
      displayUrl: isUpload ? adapter.getPublicUrl(img.storageKey!) : fallback(img),
      thumbnailUrl: isUpload
        ? adapter.getThumbnailUrl(img.storageKey!, THUMBNAIL_WIDTH.GRID)
        : fallback(img),
    }
  })
}
