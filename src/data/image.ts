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
  /**
   * Story 35.3 / FR136: media discriminator + video metadata + poster URL.
   * `mediaType` defaults to 'IMAGE' for pre-Story-35.1 rows (DB column
   * has NOT NULL DEFAULT 'IMAGE'). `durationSeconds` is null for IMAGE.
   * `posterUrl` is null for IMAGE AND for VIDEO when the adapter is S3
   * (no transformation grammar). Cloudinary VIDEO returns a `so_auto`
   * poster URL. Never null for IMAGE — the gate is enforced server-side
   * so components can assume IMAGE never carries a 404-prone poster URL.
   */
  mediaType: 'IMAGE' | 'VIDEO'
  durationSeconds: number | null
  posterUrl: string | null
}

/**
 * Story 35.3 / FR136 — `mediaType`-gated poster URL resolution.
 *
 * `getVideoPosterUrl` is documented to be called ONLY for VIDEO assets
 * (Cloudinary `public_id` syntax can't self-distinguish image vs video;
 * see `adapter.ts` JSDoc). This data-layer gate is the canonical
 * enforcement point: IMAGE rows MUST resolve `posterUrl: null`. Without
 * this gate, an IMAGE row routed through the poster path produces a
 * URL that 404s at delivery time (Story 35.2 code-review HIGH finding).
 *
 * **Exported** so `data/gallery.ts` (Story 35.4) and any other data-
 * layer file resolving poster URLs from step_image rows can reuse the
 * same gate — one canonical contract, no drift.
 */
export function resolveStepImagePosterUrl(
  adapter: ReturnType<typeof getImageStorageAdapter>,
  img: {
    mediaType: 'IMAGE' | 'VIDEO'
    storageKey: string | null
    type: 'UPLOAD' | 'LINK'
  },
  width: number = THUMBNAIL_WIDTH.PHOTO_GRID,
): string | null {
  if (!adapter) return null
  if (img.mediaType !== 'VIDEO') return null
  if (img.type !== 'UPLOAD') return null
  if (!img.storageKey) return null
  return adapter.getVideoPosterUrl(img.storageKey, width)
}

/** Find a single step image by id, including step→project context for cleanup.
 *
 * Story 35.2 selects `mediaType` so `deleteStepImage` can route
 * `resource_type: 'video'` to Cloudinary's `destroy()` for VIDEO rows —
 * closes the Story 35.1 code-review HIGH-severity defer. Without this,
 * Cloudinary silently no-ops on video keys and orphans the bytes.
 */
export async function findStepImageWithContext(id: string) {
  return prisma.stepImage.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      storageKey: true,
      mediaType: true,
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
    // FR131 — ASC by createdAt for build-log timeline narrative.
    // Story 33.6's step_image_step_id_created_at_idx is declared DESC;
    // Postgres reverse-scans a B-tree at zero cost, so ASC queries
    // continue to use the index. Do NOT "fix" the index direction.
    orderBy: { createdAt: 'asc' },
  })

  const adapter = getImageStorageAdapter()
  const fallback = (img: { url: string | null }) => img.url ?? ''

  return images.map((img) => {
    const isUpload = img.type === 'UPLOAD' && img.storageKey && adapter
    const isVideo = img.mediaType === 'VIDEO'
    // Story 35.3 / FR136: VIDEO uploads serve their playable URL from
    // adapter.getVideoUrl (Cloudinary uses /video/upload/<key>; S3 uses
    // the same shape as getPublicUrl). IMAGE keeps the existing path.
    const displayUrl = isUpload
      ? isVideo
        ? adapter.getVideoUrl(img.storageKey!)
        : adapter.getPublicUrl(img.storageKey!)
      : fallback(img)
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
      displayUrl,
      // For VIDEO rows we serve the poster (when available) at thumbnail
      // sites — gallery tiles use `posterUrl` directly; legacy callers
      // that read `thumbnailUrl` get the poster too. S3 mode returns
      // null → fallback to empty (caller renders generic play-icon card).
      thumbnailUrl: isUpload
        ? isVideo
          ? (resolveStepImagePosterUrl(adapter, img) ?? '')
          : adapter.getThumbnailUrl(img.storageKey!, THUMBNAIL_WIDTH.PHOTO_GRID)
        : fallback(img),
      mediaType: img.mediaType,
      durationSeconds: img.durationSeconds,
      // resolvePosterUrl enforces the mediaType === 'VIDEO' gate; IMAGE
      // rows always get null here (no 404-prone URL ever leaks to UI).
      posterUrl: resolveStepImagePosterUrl(adapter, img),
    }
  })
}
