import { prisma } from '@/lib/db'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'
import { resolveStepImagePosterUrl } from '@/data/image'

// Story 35.6 / FR139 — widen the photo metadata to include mediaType so
// the project-card thumbnail can branch between IMAGE (existing path) and
// VIDEO (Cloudinary so_auto poster or S3 generic play-icon card). Without
// this, VIDEO public_ids routed through `adapter.getThumbnailUrl` produce
// `/image/upload/<video-key>` URLs that 404 on Cloudinary — the bug a real
// user hit on 2026-05-15 immediately after Story 35.5 unblocked video
// uploads in prod.
export type LatestProjectPhoto = {
  storageKey: string | null
  originalFilename: string | null
  mediaType: 'IMAGE' | 'VIDEO'
  type: 'UPLOAD' | 'LINK'
  url: string | null
}

/**
 * Batch-fetch the latest UPLOAD-or-LINK step image per project (most recent
 * by `createdAt`). Returns a Map keyed by projectId. Avoids the N+1 you'd get
 * from per-project queries.
 *
 * Used by `getAllProjects`, `getProjectsByHobby`, and `getDashboardData` so
 * project cards can show a thumbnail.
 */
export async function fetchLatestPhotosByProject(
  projectIds: string[],
): Promise<Map<string, LatestProjectPhoto>> {
  const result = new Map<string, LatestProjectPhoto>()
  if (projectIds.length === 0) return result

  const photos = await prisma.stepImage.findMany({
    where: { step: { projectId: { in: projectIds } } },
    // Project-card hero intentionally surfaces the most-recent photo (DESC).
    // Contrast with step + gallery surfaces (Story 34.2 / FR131) which read
    // ASC for build-log timeline narrative. Do NOT flip this query — the
    // asymmetry is by design.
    orderBy: { createdAt: 'desc' },
    select: {
      storageKey: true,
      originalFilename: true,
      // Story 35.6 / FR139 — mediaType + type + url so the resolver can
      // route VIDEO rows through `adapter.getVideoPosterUrl` instead of
      // the IMAGE pipeline. `url` covers LINK-type IMAGE rows (rare on
      // step images but the schema allows it).
      mediaType: true,
      type: true,
      url: true,
      step: { select: { projectId: true } },
    },
  })

  for (const photo of photos) {
    if (!result.has(photo.step.projectId)) {
      result.set(photo.step.projectId, {
        storageKey: photo.storageKey,
        originalFilename: photo.originalFilename,
        mediaType: photo.mediaType,
        type: photo.type,
        url: photo.url,
      })
    }
  }
  return result
}

/**
 * Resolve the thumbnail URL for a latest project photo.
 *
 * Story 35.6 / FR139 — branches on `mediaType`:
 *  - VIDEO + UPLOAD + storageKey → `adapter.getVideoPosterUrl` (Cloudinary
 *    `so_auto` poster URL; S3 returns null and the caller renders a
 *    generic play-icon card via `ProjectCard`).
 *  - IMAGE + UPLOAD + storageKey → existing `adapter.getThumbnailUrl` path.
 *  - Anything else (LINK rows, missing storageKey, no adapter, adapter
 *    throws) → null.
 *
 * The VIDEO gate is delegated to `resolveStepImagePosterUrl` (`data/image.ts`)
 * so the codebase has one canonical gate — matches what `data/gallery.ts`,
 * `data/dashboard.ts`, and `lib/gallery-metadata.ts` already do.
 *
 * Width is sized for the project card's 64-CSS-px thumbnail (2x retina = 128).
 */
export function resolveProjectThumbnailUrl(
  photo: LatestProjectPhoto | null | undefined,
): string | null {
  if (!photo?.storageKey) return null
  try {
    const adapter = getImageStorageAdapter()
    if (!adapter) return null
    if (photo.mediaType === 'VIDEO') {
      return resolveStepImagePosterUrl(
        adapter,
        { mediaType: photo.mediaType, storageKey: photo.storageKey, type: photo.type },
        THUMBNAIL_WIDTH.DASHBOARD_CARD,
      )
    }
    // IMAGE + UPLOAD path (LINK-type IMAGE is rare on step_images; the
    // caller's `photo.url` covers it but `ProjectCard` uses the resolved
    // URL exclusively today — preserve the existing behaviour).
    return adapter.getThumbnailUrl(photo.storageKey, THUMBNAIL_WIDTH.DASHBOARD_CARD)
  } catch {
    return null
  }
}
