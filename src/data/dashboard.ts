/**
 * Data access layer for the dashboard aggregate.
 *
 * Composes from primitive `data/*` modules. Preserves the existing
 * N+1-avoidance patterns (parallel queries via Promise.all, batched latest
 * photo fetch via `fetchLatestPhotosByProject`).
 *
 * Caller (the action) supplies the idle threshold date so this function
 * stays settings-agnostic.
 */

import { prisma } from '@/lib/db'
import { DASHBOARD_LIMITS } from '@/lib/constants/dashboard-limits'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { fetchLatestPhotosByProject } from '@/data/project-photos'
import { resolveStepImagePosterUrl } from '@/data/image'
import { deriveProjectStatus } from '@/lib/project-status'
import { computeProjectTotalHours } from '@/lib/project-hours'
import { findActiveBlockers } from './blocker'
import type {
  DashboardData,
  RecentProject,
  ActiveBlocker,
  IdleProject,
  PublicGallery,
} from '@/lib/schemas/dashboard'

export async function findDashboardData(idleThresholdDate: Date): Promise<DashboardData> {
  // Run primary aggregates in parallel.
  const [totalHobbies, rawRecentProjects, rawActiveBlockers, rawIdleProjects, rawGalleries] =
    await Promise.all([
      prisma.hobby.count(),

      // 5 most recent active projects
      prisma.project.findMany({
        where: { isArchived: false, isCompleted: false },
        orderBy: { lastActivityAt: 'desc' },
        take: DASHBOARD_LIMITS.RECENT_PROJECTS,
        include: {
          hobby: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
              hoursTrackingEnabled: true,
            },
          },
          steps: {
            select: { id: true, name: true, state: true, sortOrder: true, hoursLogged: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),

      // All unresolved blockers with context (delegates to data/blocker.ts)
      findActiveBlockers(),

      // Idle projects
      prisma.project.findMany({
        where: {
          isArchived: false,
          isCompleted: false,
          lastActivityAt: { lt: idleThresholdDate },
        },
        orderBy: { lastActivityAt: 'asc' },
        take: DASHBOARD_LIMITS.IDLE_PROJECTS,
        include: {
          hobby: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
              hoursTrackingEnabled: true,
            },
          },
          steps: {
            select: { id: true, name: true, state: true, sortOrder: true, hoursLogged: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),

      // Public galleries (up to 3 most recent)
      prisma.project.findMany({
        where: {
          OR: [{ journeyGalleryEnabled: true }, { resultGalleryEnabled: true }],
          gallerySlug: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        take: DASHBOARD_LIMITS.PUBLIC_GALLERIES,
        select: {
          id: true,
          name: true,
          hobbyId: true,
          gallerySlug: true,
          journeyGalleryEnabled: true,
          resultGalleryEnabled: true,
          hobby: { select: { id: true, name: true, color: true, icon: true } },
          steps: {
            where: { excludeFromGallery: false },
            orderBy: { sortOrder: 'asc' },
            select: {
              images: {
                take: DASHBOARD_LIMITS.GALLERY_THUMBNAILS,
                // FR131 — ASC by createdAt for build-log timeline narrative.
                // Story 33.6's step_image_step_id_created_at_idx is declared
                // DESC; Postgres reverse-scans a B-tree at zero cost, so ASC
                // queries continue to use the index.
                orderBy: { createdAt: 'asc' },
                // Story 35.4 / FR137 — widen to include mediaType so the
                // dashboard thumbnail branch can route VIDEO rows
                // through the same data-layer poster gate as the public
                // gallery surfaces.
                select: {
                  storageKey: true,
                  url: true,
                  type: true,
                  mediaType: true,
                },
              },
            },
          },
        },
      }),
    ])

  // Batched latest-photo fetch (avoids N+1 across recentProjects)
  const latestPhotoByProject = await fetchLatestPhotosByProject(
    rawRecentProjects.map((project) => project.id),
  )

  const recentProjects: RecentProject[] = rawRecentProjects.map((project) => {
    const currentStepData =
      project.steps.find((step) => step.state === 'IN_PROGRESS') ??
      project.steps.find((step) => step.state === 'NOT_STARTED')

    return {
      id: project.id,
      name: project.name,
      lastActivityAt: project.lastActivityAt,
      hobbyId: project.hobbyId,
      hobby: {
        id: project.hobby.id,
        name: project.hobby.name,
        color: project.hobby.color,
        icon: project.hobby.icon,
      },
      currentStep: currentStepData ? { id: currentStepData.id, name: currentStepData.name } : null,
      latestPhoto: latestPhotoByProject.get(project.id) ?? null,
      totalSteps: project.steps.length,
      completedSteps: project.steps.filter((step) => step.state === 'COMPLETED').length,
      derivedStatus: deriveProjectStatus(project.steps),
      totalHoursLogged: computeProjectTotalHours(project.steps, project.hobby.hoursTrackingEnabled),
    }
  })

  const activeBlockers: ActiveBlocker[] = rawActiveBlockers.map((blocker) => ({
    id: blocker.id,
    description: blocker.description,
    createdAt: blocker.createdAt,
    step: {
      id: blocker.step.id,
      name: blocker.step.name,
      project: {
        id: blocker.step.project.id,
        name: blocker.step.project.name,
        hobbyId: blocker.step.project.hobbyId,
        hobby: blocker.step.project.hobby,
      },
    },
  }))

  const idleProjects: IdleProject[] = rawIdleProjects.map((project) => {
    const currentStepData =
      project.steps.find((step) => step.state === 'IN_PROGRESS') ??
      project.steps.find((step) => step.state === 'NOT_STARTED')
    return {
      id: project.id,
      name: project.name,
      lastActivityAt: project.lastActivityAt,
      hobbyId: project.hobbyId,
      hobby: {
        id: project.hobby.id,
        name: project.hobby.name,
        color: project.hobby.color,
        icon: project.hobby.icon,
      },
      currentStep: currentStepData ? { id: currentStepData.id, name: currentStepData.name } : null,
      totalHoursLogged: computeProjectTotalHours(project.steps, project.hobby.hoursTrackingEnabled),
    }
  })

  // Story 35.4 / FR137 — resolve the adapter once per call so each
  // VIDEO thumbnail can route through `resolveStepImagePosterUrl` (the
  // shared data-layer gate). This closes the Story 35.3 Cloudinary
  // contract divergence — the dashboard surface and the public gallery
  // surfaces both gate on `mediaType === 'VIDEO'` before producing a
  // poster URL, so the Cloudinary `so_auto` URL is never minted for
  // non-VIDEO rows.
  const adapter = getImageStorageAdapter()
  const publicGalleries: PublicGallery[] = rawGalleries.map((gallery) => ({
    id: gallery.id,
    name: gallery.name,
    hobbyId: gallery.hobbyId,
    gallerySlug: gallery.gallerySlug!,
    journeyGalleryEnabled: gallery.journeyGalleryEnabled,
    resultGalleryEnabled: gallery.resultGalleryEnabled,
    hobby: gallery.hobby,
    thumbnails: gallery.steps
      .flatMap((step) => step.images)
      .slice(0, DASHBOARD_LIMITS.GALLERY_THUMBNAILS)
      .map((img) => {
        const isVideo = img.mediaType === 'VIDEO'
        // VIDEO thumbnails return `url: ''` so the rendering layer
        // falls through to the poster (Cloudinary) or generic play-icon
        // card (S3 null poster). IMAGE keeps the existing thumbnail URL.
        let url = ''
        if (img.type === 'UPLOAD' && img.storageKey && !isVideo) {
          if (adapter) {
            try {
              url = adapter.getThumbnailUrl(img.storageKey, THUMBNAIL_WIDTH.GALLERY_SECTION)
            } catch {
              /* fall through */
            }
          }
        } else if (!isVideo) {
          url = img.url ?? ''
        }
        // Poster URL only ever mints for Cloudinary VIDEO uploads; S3
        // VIDEO returns null (UI renders generic play-icon card).
        const posterUrl = resolveStepImagePosterUrl(
          adapter,
          {
            mediaType: img.mediaType,
            storageKey: img.storageKey,
            type: img.type as 'UPLOAD' | 'LINK',
          },
          THUMBNAIL_WIDTH.GALLERY_SECTION,
        )
        return {
          url,
          mediaType: img.mediaType as 'IMAGE' | 'VIDEO',
          posterUrl,
        }
      })
      // Keep entries that have either a renderable image URL OR are a
      // VIDEO row (which will render its poster / play-icon card even
      // when `url` is empty).
      .filter((thumb) => thumb.url !== '' || thumb.mediaType === 'VIDEO'),
  }))

  return { totalHobbies, recentProjects, activeBlockers, idleProjects, publicGalleries }
}
