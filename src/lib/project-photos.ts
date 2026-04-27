import { prisma } from '@/lib/db'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

export type LatestProjectPhoto = {
  storageKey: string | null
  originalFilename: string | null
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
    orderBy: { createdAt: 'desc' },
    select: {
      storageKey: true,
      originalFilename: true,
      step: { select: { projectId: true } },
    },
  })

  for (const photo of photos) {
    if (!result.has(photo.step.projectId)) {
      result.set(photo.step.projectId, {
        storageKey: photo.storageKey,
        originalFilename: photo.originalFilename,
      })
    }
  }
  return result
}

/**
 * Resolve the thumbnail URL for a latest project photo. Returns null when no
 * storage key, no adapter, or the adapter throws. Width is sized for the
 * project card's 64-CSS-px thumbnail (2x for retina = 128).
 */
export function resolveProjectThumbnailUrl(
  photo: LatestProjectPhoto | null | undefined,
): string | null {
  if (!photo?.storageKey) return null
  try {
    const adapter = getImageStorageAdapter()
    if (!adapter) return null
    return adapter.getThumbnailUrl(photo.storageKey, THUMBNAIL_WIDTH.DASHBOARD_CARD)
  } catch {
    return null
  }
}
