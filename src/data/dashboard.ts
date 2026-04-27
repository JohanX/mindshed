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
import { fetchLatestPhotosByProject } from '@/lib/project-photos'
import { deriveProjectStatus } from '@/lib/project-status'
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
          hobby: { select: { id: true, name: true, color: true, icon: true } },
          steps: {
            select: { id: true, name: true, state: true, sortOrder: true },
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
          hobby: { select: { id: true, name: true, color: true, icon: true } },
          steps: {
            select: { id: true, name: true, state: true, sortOrder: true },
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
                orderBy: { createdAt: 'desc' },
                select: { storageKey: true, url: true, type: true },
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
      hobby: project.hobby,
      currentStep: currentStepData ? { id: currentStepData.id, name: currentStepData.name } : null,
      latestPhoto: latestPhotoByProject.get(project.id) ?? null,
      totalSteps: project.steps.length,
      completedSteps: project.steps.filter((step) => step.state === 'COMPLETED').length,
      derivedStatus: deriveProjectStatus(project.steps),
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
      hobby: project.hobby,
      currentStep: currentStepData ? { id: currentStepData.id, name: currentStepData.name } : null,
    }
  })

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
        if (img.type === 'UPLOAD' && img.storageKey) {
          const adapter = getImageStorageAdapter()
          if (adapter) {
            try {
              return adapter.getThumbnailUrl(img.storageKey, THUMBNAIL_WIDTH.GALLERY_SECTION)
            } catch {
              /* fall through */
            }
          }
        }
        return img.url ?? ''
      })
      .filter(Boolean),
  }))

  return { totalHobbies, recentProjects, activeBlockers, idleProjects, publicGalleries }
}
