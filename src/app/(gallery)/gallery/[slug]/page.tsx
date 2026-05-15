export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findJourneyGalleryBySlug } from '@/data/gallery'
import { JourneyGalleryView } from '@/components/gallery/journey-gallery-view'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'
import { buildJourneyMetadata } from '@/lib/gallery-metadata'
import { resolveStepImagePosterUrl } from '@/data/image'
import { computeProjectTotalHours } from '@/lib/project-hours'
import { formatHours } from '@/lib/hours-format'

interface JourneyGalleryPageProps {
  params: Promise<{ slug: string }>
}

// Story 30.4 / FR128 — Open Graph + Twitter Card metadata for shared links.
export async function generateMetadata({ params }: JourneyGalleryPageProps): Promise<Metadata> {
  const { slug } = await params
  return buildJourneyMetadata(slug)
}

function getPublicImageUrl(storageKey: string): string {
  const adapter = getImageStorageAdapter()
  if (!adapter) return ''
  try {
    return adapter.getPublicUrl(storageKey)
  } catch {
    return ''
  }
}

function getThumbnailImageUrl(storageKey: string, width: number): string {
  const adapter = getImageStorageAdapter()
  if (!adapter) return ''
  try {
    return adapter.getThumbnailUrl(storageKey, width)
  } catch {
    return ''
  }
}

// Story 35.4 / FR137 — video URL for VIDEO step images on the public
// gallery surface. Cloudinary uses /video/upload/<key>; S3 mirrors
// getPublicUrl. Mirrors the helpers in the project detail page so the
// public surface routes video bytes through the same adapter method.
function getVideoImageUrl(storageKey: string): string {
  const adapter = getImageStorageAdapter()
  if (!adapter) return ''
  try {
    return adapter.getVideoUrl(storageKey)
  } catch {
    return ''
  }
}

export default async function JourneyGalleryPage({ params }: JourneyGalleryPageProps) {
  const { slug } = await params

  const project = await findJourneyGalleryBySlug(slug)

  if (!project || !project.journeyGalleryEnabled) notFound()

  // Story 30.5 / FR129 — total hours summed across ALL steps (not filtered
  // by `excludeFromGallery`) so the journey total matches the result-
  // gallery total and the project-detail total. Tracking-disabled hobbies
  // get null; formatHours hides 0/null on the UI side.
  const totalHoursLogged = computeProjectTotalHours(
    project.steps,
    project.hobby.hoursTrackingEnabled,
  )

  // Filter to visible steps (excludeFromGallery=false AND has images) for
  // rendering. The data accessor returns all steps so the FR129 total can
  // sum the whole project; the page narrows for display.
  const adapter = getImageStorageAdapter()
  const stepsWithImages = project.steps
    .filter((step) => !step.excludeFromGallery && step.images.length > 0)
    .map((step) => ({
      name: step.name,
      notes: step.notes,
      images: step.images.map((img) => {
        const isUpload = img.type === 'UPLOAD' && img.storageKey
        const isVideo = img.mediaType === 'VIDEO'
        // Story 35.4 / FR137: VIDEO uploads serve their playable URL
        // from adapter.getVideoUrl (Cloudinary /video/upload/<key>; S3
        // mirrors getPublicUrl). VIDEO LINK rows fall through to the
        // stored URL verbatim (FR134 OUT-of-V1 path, but defensive).
        //
        // Code-review patch (Story 35.4 / Edge Hunter #2): when the
        // adapter is unavailable at runtime (misconfigured env), the
        // helpers return `''` — propagating that to a `<video src="">`
        // resolves against the page URL and fails as a media source.
        // Surface this as the broken-state branch in the lightbox by
        // leaving displayUrl `''`; the lightbox already renders the
        // `mediaType`-aware "could not be loaded" copy in that case.
        const displayUrl = isUpload
          ? isVideo
            ? getVideoImageUrl(img.storageKey!)
            : getPublicImageUrl(img.storageKey!)
          : (img.url ?? '')
        // Story 35.4 / FR137: posterUrl is gated server-side via the
        // shared resolveStepImagePosterUrl helper — IMAGE rows + LINK
        // rows + S3-mode VIDEO uploads all get null. Cloudinary
        // VIDEO uploads get the so_auto poster URL.
        const posterUrl = resolveStepImagePosterUrl(
          adapter,
          {
            mediaType: img.mediaType,
            storageKey: img.storageKey,
            type: img.type as 'UPLOAD' | 'LINK',
          },
          THUMBNAIL_WIDTH.GRID,
        )
        // thumbnailUrl semantics for the gallery surface: VIDEO uses
        // the poster (when available; else empty → component renders
        // generic play-icon card). IMAGE uses the existing thumbnail.
        const thumbnailUrl = isUpload
          ? isVideo
            ? (posterUrl ?? '')
            : getThumbnailImageUrl(img.storageKey!, THUMBNAIL_WIDTH.GRID)
          : (img.url ?? '')
        return {
          displayUrl,
          thumbnailUrl,
          originalFilename: img.originalFilename,
          mediaType: img.mediaType,
          durationSeconds: img.durationSeconds,
          posterUrl,
        }
      }),
    }))

  return (
    <JourneyGalleryView
      project={{
        name: project.name,
        description: project.description,
        hobby: project.hobby,
        totalHoursLabel: formatHours(totalHoursLogged),
      }}
      steps={stepsWithImages}
    />
  )
}
