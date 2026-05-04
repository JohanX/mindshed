export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findResultGalleryBySlug } from '@/data/gallery'
import { ResultGalleryView } from '@/components/gallery/result-gallery-view'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { buildResultMetadata } from '@/lib/gallery-metadata'
import { computeProjectTotalHours } from '@/lib/project-hours'
import { formatHours } from '@/lib/hours-format'

interface ResultGalleryPageProps {
  params: Promise<{ slug: string }>
}

// Story 30.4 / FR128 — Open Graph + Twitter Card metadata for shared links.
export async function generateMetadata({ params }: ResultGalleryPageProps): Promise<Metadata> {
  const { slug } = await params
  return buildResultMetadata(slug)
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

  const project = await findResultGalleryBySlug(slug)

  if (!project || !project.resultGalleryEnabled) notFound()

  // Story 30.5 / FR129 — total hours summed across the WHOLE project (all
  // states), not just completed steps. The displayed result-step image
  // selection still uses only COMPLETED steps below.
  const totalHoursLogged = computeProjectTotalHours(
    project.steps,
    project.hobby.hoursTrackingEnabled,
  )

  // Determine result step: explicit or last completed.
  const completedSteps = project.steps.filter((step) => step.state === 'COMPLETED')
  const resultStep = project.resultStepId
    ? completedSteps.find((step) => step.id === project.resultStepId)
    : completedSteps[0] // Already sorted desc by sortOrder, first = last completed

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
        totalHoursLabel: formatHours(totalHoursLogged),
      }}
      images={images}
    />
  )
}
