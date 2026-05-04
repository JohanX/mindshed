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

/** Journey gallery shape: project + steps with images + notes. */
export const findJourneyGalleryBySlug = cache(async (slug: string) => {
  return prisma.project.findUnique({
    where: { gallerySlug: slug },
    select: {
      name: true,
      description: true,
      journeyGalleryEnabled: true,
      hobby: { select: { name: true, color: true, icon: true } },
      steps: {
        where: { excludeFromGallery: false },
        orderBy: { sortOrder: 'asc' },
        select: {
          name: true,
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
      hobby: { select: { name: true, color: true, icon: true } },
      steps: {
        where: { state: 'COMPLETED' },
        orderBy: { sortOrder: 'desc' },
        select: {
          id: true,
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
