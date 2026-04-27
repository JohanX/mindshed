export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { findJourneyGalleryBySlug } from '@/data/gallery'
import { JourneyGalleryView } from '@/components/gallery/journey-gallery-view'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

interface JourneyGalleryPageProps {
  params: Promise<{ slug: string }>
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

export default async function JourneyGalleryPage({ params }: JourneyGalleryPageProps) {
  const { slug } = await params

  const project = await findJourneyGalleryBySlug(slug)

  if (!project || !project.journeyGalleryEnabled) notFound()

  // Filter to only steps with images
  const stepsWithImages = project.steps
    .filter((step) => step.images.length > 0)
    .map((step) => ({
      name: step.name,
      notes: step.notes,
      images: step.images.map((img) => {
        const isUpload = img.type === 'UPLOAD' && img.storageKey
        return {
          displayUrl: isUpload ? getPublicImageUrl(img.storageKey!) : (img.url ?? ''),
          thumbnailUrl: isUpload
            ? getThumbnailImageUrl(img.storageKey!, THUMBNAIL_WIDTH.GRID)
            : (img.url ?? ''),
          originalFilename: img.originalFilename,
        }
      }),
    }))

  return (
    <JourneyGalleryView
      project={{
        name: project.name,
        description: project.description,
        hobby: project.hobby,
      }}
      steps={stepsWithImages}
    />
  )
}
