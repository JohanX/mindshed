/**
 * Data access layer for the public gallery views.
 *
 * Gallery routes are public (`src/proxy.ts` bypasses auth for `/gallery`).
 * They use `force-dynamic` so reads run on every request — no caching.
 */

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
export async function findJourneyGalleryBySlug(slug: string) {
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
            select: { storageKey: true, url: true, type: true, originalFilename: true },
          },
          notes: {
            orderBy: { createdAt: 'desc' },
            select: { text: true },
          },
        },
      },
    },
  })
}

/** Result gallery shape: project + completed steps with images. */
export async function findResultGalleryBySlug(slug: string) {
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
}

/**
 * Other slugs (excluding `existingId`) — used by the slug-uniqueness pass
 * inside enable-gallery actions.
 */
export async function findOtherGallerySlugs(existingId: string) {
  const rows = await prisma.project.findMany({
    where: { gallerySlug: { not: null }, id: { not: existingId } },
    select: { gallerySlug: true },
  })
  return rows.map((r) => r.gallerySlug).filter((s): s is string => s !== null)
}
