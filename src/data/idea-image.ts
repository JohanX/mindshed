/**
 * Data access layer for IdeaImage.
 *
 * IdeaImage is 1-to-1 with Idea via `@@unique([ideaId])`. The replace-on-add
 * write flow lives in `src/actions/idea-image.ts` because it spans a
 * transaction + storage cleanup + revalidatePath. This module covers the
 * read paths.
 */

import { prisma } from '@/lib/db'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

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

/** Find the raw IdeaImage row for an idea. Returns null when no photo. */
export async function findIdeaImage(ideaId: string) {
  return prisma.ideaImage.findUnique({ where: { ideaId } })
}

/**
 * Find the IdeaImage with display + thumbnail URLs resolved server-side.
 * Used by the edit dialog. Returns null when no photo.
 */
export async function findIdeaImageWithDisplayUrl(
  ideaId: string,
): Promise<IdeaImageWithDisplayUrl | null> {
  const image = await prisma.ideaImage.findUnique({ where: { ideaId } })
  if (!image) return null

  const adapter = getImageStorageAdapter()
  const fallback = image.url ?? ''
  const isUpload = image.type === 'UPLOAD' && image.storageKey && adapter

  return {
    id: image.id,
    ideaId: image.ideaId,
    type: image.type as 'UPLOAD' | 'LINK',
    storageKey: image.storageKey,
    url: image.url,
    originalFilename: image.originalFilename,
    contentType: image.contentType,
    sizeBytes: image.sizeBytes,
    createdAt: image.createdAt,
    displayUrl: isUpload ? adapter.getPublicUrl(image.storageKey!) : fallback,
    thumbnailUrl: isUpload
      ? adapter.getThumbnailUrl(image.storageKey!, THUMBNAIL_WIDTH.INVENTORY_CARD)
      : fallback,
  }
}
