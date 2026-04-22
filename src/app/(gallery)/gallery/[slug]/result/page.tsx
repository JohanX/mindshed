export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ResultGalleryView } from '@/components/gallery/result-gallery-view'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'

interface ResultGalleryPageProps {
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

export default async function ResultGalleryPage({ params }: ResultGalleryPageProps) {
  const { slug } = await params

  const project = await prisma.project.findUnique({
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

  if (!project || !project.resultGalleryEnabled) notFound()

  // Determine result step: explicit or last completed
  const resultStep = project.resultStepId
    ? project.steps.find((s) => s.id === project.resultStepId)
    : project.steps[0] // Already sorted desc by sortOrder, first = last completed

  const images = (resultStep?.images ?? []).map((img) => ({
    displayUrl:
      img.type === 'UPLOAD' && img.storageKey ? getPublicImageUrl(img.storageKey) : (img.url ?? ''),
    originalFilename: img.originalFilename,
  }))

  return (
    <ResultGalleryView
      project={{
        name: project.name,
        description: project.description,
        hobby: project.hobby,
      }}
      images={images}
    />
  )
}
