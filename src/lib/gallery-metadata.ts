/**
 * Story 30.4 / FR128 — Open Graph + Twitter Card metadata builders for the
 * public gallery routes. Called from `generateMetadata({ params })` in
 * `src/app/(gallery)/gallery/[slug]/page.tsx` (journey) and
 * `.../[slug]/result/page.tsx` (result).
 *
 * Returns `{}` when the gallery is missing or its enabling flag is false —
 * Next 16 falls back to the root metadata, so social-link unfurlers see the
 * plain MindShed defaults rather than a misleading preview pointed at a
 * URL that will land on a 404.
 *
 * Image selection rules mirror the page renderers exactly so the unfurl
 * preview matches what the recipient sees on click-through. Specifically:
 * if the chosen result step has no images, the result-route metadata
 * emits NO og:image (matches the page, which renders nothing) — no rollup
 * to other steps' images that would diverge preview from landing page.
 */

import type { Metadata } from 'next'
import { findJourneyGalleryBySlug, findResultGalleryBySlug } from '@/data/gallery'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

const MAX_EXTRA_OG_IMAGES = 3
const SOCIAL_CARD_HEIGHT = 630 // recommended OG aspect for `summary_large_image` (1200×630)

type GalleryImage = {
  storageKey: string | null
  url: string | null
  type: 'UPLOAD' | 'LINK'
  originalFilename: string | null
  createdAt?: Date
}

function resolveSocialImageUrl(img: GalleryImage): string | null {
  if (img.type === 'UPLOAD' && img.storageKey) {
    const adapter = getImageStorageAdapter()
    if (!adapter) return null
    try {
      return adapter.getThumbnailUrl(img.storageKey, THUMBNAIL_WIDTH.SOCIAL_CARD)
    } catch (error) {
      console.warn(
        `[gallery-metadata] storage adapter threw for storageKey=${img.storageKey}; skipping image`,
        error,
      )
      return null
    }
  }
  return img.url ?? null
}

/**
 * Collect up to `1 + MAX_EXTRA_OG_IMAGES` distinct image URLs in the order
 * the caller supplies. The first URL is the primary `og:image` (and
 * `twitter:image`); the rest are enrichment for clients that honour
 * multi-image OG. (Reality: Slack/WhatsApp/Telegram/Twitter/LinkedIn all
 * honour only the first; extras serve Mastodon and niche unfurlers.)
 */
function collectImageUrls(images: GalleryImage[]): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const limit = 1 + MAX_EXTRA_OG_IMAGES
  for (const img of images) {
    const url = resolveSocialImageUrl(img)
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
    if (urls.length >= limit) return urls
  }
  return urls
}

/**
 * Story 30.4 — flatten all step images into one list sorted by `createdAt`
 * DESC, so the primary `og:image` is the most recently added image across
 * the project. Mirrors the dashboard project-card "latest photo" pattern
 * (`fetchLatestPhotosByProject` in `src/lib/project-photos.ts`). Falls back
 * to insertion order when `createdAt` is not provided (test fixtures).
 */
function flattenStepsByLatest(steps: { images: GalleryImage[] }[]): GalleryImage[] {
  const all = steps.flatMap((step) => step.images)
  return [...all].sort((a, b) => {
    const aTime = a.createdAt ? a.createdAt.getTime() : 0
    const bTime = b.createdAt ? b.createdAt.getTime() : 0
    return bTime - aTime
  })
}

/**
 * Map collected URLs to OG image descriptors. The `width`/`height` are the
 * REQUESTED width via the storage adapter (`SOCIAL_CARD = 1200`) and the
 * standard `summary_large_image` aspect (630). Slack / LinkedIn / Discord
 * use these to lay out the unfurl card before fetching the image, avoiding
 * layout shift and preventing degraded thumbnail rendering on LinkedIn.
 */
function toOgImages(urls: string[]) {
  return urls.map((url) => ({
    url,
    width: THUMBNAIL_WIDTH.SOCIAL_CARD,
    height: SOCIAL_CARD_HEIGHT,
  }))
}

export async function buildJourneyMetadata(slug: string): Promise<Metadata> {
  const project = await findJourneyGalleryBySlug(slug)
  if (!project || !project.journeyGalleryEnabled) return {}

  const stepsWithImages = project.steps.filter((step) => step.images.length > 0)
  // Primary og:image = most recent across all steps (matches dashboard
  // "latest photo" — major social unfurlers honour only the first image).
  const imageUrls = collectImageUrls(flattenStepsByLatest(stepsWithImages))

  const title = `${project.name} — Journey Gallery`
  const description =
    project.description ?? `${stepsWithImages.length} steps from idea to completion.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: toOgImages(imageUrls),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrls.length > 0 ? [imageUrls[0]] : undefined,
    },
  }
}

export async function buildResultMetadata(slug: string): Promise<Metadata> {
  const project = await findResultGalleryBySlug(slug)
  if (!project || !project.resultGalleryEnabled) return {}

  // Mirror the page renderer's selection rule (result/page.tsx:30-32):
  //   resultStepId set → that step
  //   else            → first step (already sorted desc by sortOrder, so
  //                     this is the most recently completed step)
  const resultStep = project.resultStepId
    ? project.steps.find((step) => step.id === project.resultStepId)
    : project.steps[0]

  // Match the page renderer EXACTLY — when the chosen step has no images,
  // the page renders no images. Emitting og:image from arbitrary OTHER
  // completed steps would diverge the unfurl preview from the landing
  // page (the unfurl shows photos the recipient can't find on click).
  // Within the chosen step, images are already sorted by createdAt DESC by
  // the data accessor — most recent first.
  const imageUrls = collectImageUrls(resultStep?.images ?? [])

  const title = `${project.name} — Result`
  const description = project.description ?? `Final result from ${project.name}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: toOgImages(imageUrls),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrls.length > 0 ? [imageUrls[0]] : undefined,
    },
  }
}
