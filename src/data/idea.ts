/**
 * Data access layer for Idea.
 *
 * Canonical home for the `IdeaWithThumbnail` and `IdeaWithHobby` types
 * (both extended with a server-resolved `thumbnailUrl` so client cards can
 * render the photo without importing the image storage adapter).
 */

import { prisma } from '@/lib/db'
import type { Idea } from '@/generated/prisma/client'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

export type IdeaWithThumbnail = Idea & { thumbnailUrl: string | null }

export type IdeaWithHobby = IdeaWithThumbnail & {
  hobby: { id: string; name: string; color: string; icon: string | null }
}

/**
 * Pure helper: given an `IdeaImage` minimal projection, return the URL to
 * use as the card thumbnail. UPLOAD type → adapter `getThumbnailUrl`,
 * LINK type → use the stored URL directly. `null` when no image.
 */
export function deriveIdeaThumbnail(
  image: {
    type: string
    storageKey: string | null
    url: string | null
  } | null,
): string | null {
  if (!image) return null
  if (image.type === 'UPLOAD' && image.storageKey) {
    const adapter = getImageStorageAdapter()
    if (adapter) return adapter.getThumbnailUrl(image.storageKey, THUMBNAIL_WIDTH.INVENTORY_CARD)
  }
  return image.url ?? null
}

/** Find a single idea by id (no relations). */
export async function findIdeaById(id: string) {
  return prisma.idea.findUnique({ where: { id } })
}

/**
 * Idea + minimal fields needed by `promoteIdea` action's pre-check
 * (existence + isPromoted + hobbyId). Returns null when not found.
 */
export async function findIdeaForPromotion(id: string) {
  return prisma.idea.findUnique({
    where: { id },
    select: { id: true, title: true, description: true, hobbyId: true, isPromoted: true },
  })
}

/** Ideas for a single hobby, ordered (unpromoted first, then by createdAt desc). */
export async function findIdeasByHobby(hobbyId: string): Promise<IdeaWithThumbnail[]> {
  const ideas = await prisma.idea.findMany({
    where: { hobbyId },
    orderBy: [{ isPromoted: 'asc' }, { createdAt: 'desc' }],
    include: { image: { select: { type: true, storageKey: true, url: true } } },
  })
  return ideas.map(({ image, ...idea }) => ({
    ...idea,
    thumbnailUrl: deriveIdeaThumbnail(image),
  }))
}

/** All ideas across hobbies, with hobby data included for cross-hobby views. */
export async function findAllIdeas(): Promise<IdeaWithHobby[]> {
  const ideas = await prisma.idea.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      hobby: { select: { id: true, name: true, color: true, icon: true } },
      image: { select: { type: true, storageKey: true, url: true } },
    },
  })
  return ideas.map(({ image, ...idea }) => ({
    ...idea,
    thumbnailUrl: deriveIdeaThumbnail(image),
  }))
}
