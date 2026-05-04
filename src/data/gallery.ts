/**
 * Data access layer for the public gallery views.
 *
 * Gallery routes are public (`src/proxy.ts` bypasses auth for `/gallery`).
 * They use `force-dynamic` so reads run on every request — no caching
 * across requests. Within a single request, however, both the page
 * renderer AND `generateMetadata` (Story 30.4 / FR128) need the same
 * data; the per-request `cache(...)` wrapper from React dedupes those
 * two call sites into one Prisma query.
 */

import { cache } from 'react'
import { prisma } from '@/lib/db'

/** Project shape rendered on the gallery index page (`/gallery`). */
export async function findPublicGalleryProjects() {
  return prisma.project.findMany({
    where: {
      OR: [{ journeyGalleryEnabled: true }, { resultGalleryEnabled: true }],
      gallerySlug: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      gallerySlug: true,
      journeyGalleryEnabled: true,
      resultGalleryEnabled: true,
      hobby: { select: { id: true, name: true, color: true, icon: true } },
    },
  })
}

/** Journey gallery shape: project + steps with images + notes.
 *
 * Returns ALL steps (not filtered by `excludeFromGallery`) so the gallery
 * page can sum the FR129 project hours total over the WHOLE project, not
 * just visible steps. The page renderer + metadata helper filter on
 * `excludeFromGallery: false` at render time. This keeps the journey total
 * consistent with the result-gallery total and the project-detail total
 * (all three sum the entire project).
 */
export const findJourneyGalleryBySlug = cache(async (slug: string) => {
  return prisma.project.findUnique({
    where: { gallerySlug: slug },
    select: {
      name: true,
      description: true,
      journeyGalleryEnabled: true,
      hobby: { select: { name: true, color: true, icon: true, hoursTrackingEnabled: true } },
      steps: {
        orderBy: { sortOrder: 'asc' },
        select: {
          name: true,
          excludeFromGallery: true,
          // Story 30.5 / FR129 — exposed so the gallery page can sum the
          // project total without a second query.
          hoursLogged: true,
          images: {
            orderBy: { createdAt: 'desc' },
            // `createdAt` is exposed for Story 30.4's gallery-metadata helper
            // so the OG primary image can be the most recent across ALL steps
            // (matches the dashboard project-card "latest photo" pattern).
            select: {
              storageKey: true,
              url: true,
              type: true,
              originalFilename: true,
              createdAt: true,
            },
          },
          notes: {
            orderBy: { createdAt: 'desc' },
            select: { text: true },
          },
        },
      },
    },
  })
})

/** Result gallery shape: project + completed steps with images. */
export const findResultGalleryBySlug = cache(async (slug: string) => {
  return prisma.project.findUnique({
    where: { gallerySlug: slug },
    select: {
      name: true,
      description: true,
      resultGalleryEnabled: true,
      resultStepId: true,
      hobby: { select: { name: true, color: true, icon: true, hoursTrackingEnabled: true } },
      steps: {
        // The full step list (across ALL states) is needed for the FR129
        // total — but the rendered result still uses only COMPLETED-step
        // images per the page renderer's filter (see result/page.tsx).
        orderBy: { sortOrder: 'desc' },
        select: {
          id: true,
          state: true,
          hoursLogged: true,
          images: {
            orderBy: { createdAt: 'desc' },
            select: { storageKey: true, url: true, type: true, originalFilename: true },
          },
        },
      },
    },
  })
})

/**
 * Other slugs (excluding `existingId`) — used by the slug-uniqueness pass
 * inside enable-gallery actions.
 */
export async function findOtherGallerySlugs(existingId: string) {
  const rows = await prisma.project.findMany({
    where: { gallerySlug: { not: null }, id: { not: existingId } },
    select: { gallerySlug: true },
  })
  return rows.map((row) => row.gallerySlug).filter((slug): slug is string => slug !== null)
}
