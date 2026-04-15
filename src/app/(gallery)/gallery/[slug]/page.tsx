export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { JourneyGalleryView } from '@/components/gallery/journey-gallery-view'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'

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

export default async function JourneyGalleryPage({ params }: JourneyGalleryPageProps) {
  const { slug } = await params

  const project = await prisma.project.findUnique({
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

  if (!project || !project.journeyGalleryEnabled) notFound()

  // Filter to only steps with images
  const stepsWithImages = project.steps
    .filter(s => s.images.length > 0)
    .map(s => ({
      name: s.name,
      notes: s.notes,
      images: s.images.map(img => ({
        displayUrl: img.type === 'UPLOAD' && img.storageKey
          ? getPublicImageUrl(img.storageKey)
          : img.url ?? '',
        originalFilename: img.originalFilename,
      })),
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
