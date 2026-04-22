'use client'

import { useState, useCallback } from 'react'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { GalleryLightbox, type GalleryLightboxImage } from '@/components/gallery/gallery-lightbox'
import { cn } from '@/lib/utils'

interface JourneyStep {
  name: string
  notes: { text: string }[]
  images: { displayUrl: string; thumbnailUrl?: string; originalFilename: string | null }[]
}

interface JourneyGalleryViewProps {
  project: {
    name: string
    description: string | null
    hobby: { name: string; color: string; icon: string | null }
  }
  steps: JourneyStep[]
}

export function JourneyGalleryView({ project, steps }: JourneyGalleryViewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Flatten all images across steps with step context for the lightbox
  const allImages: GalleryLightboxImage[] = steps.flatMap((step) =>
    step.images.map((img) => ({
      displayUrl: img.displayUrl,
      originalFilename: img.originalFilename,
      stepName: step.name,
      description: step.notes.map((note) => note.text).join(' ') || null,
    })),
  )

  // Map (stepIndex, imageIndex) to flat index
  const getFlatIndex = useCallback(
    (stepIdx: number, imgIdx: number) => {
      let flat = 0
      for (let s = 0; s < stepIdx; s++) {
        flat += steps[s].images.length
      }
      return flat + imgIdx
    },
    [steps],
  )

  const openLightbox = useCallback(
    (stepIdx: number, imgIdx: number) => {
      setLightboxIndex(getFlatIndex(stepIdx, imgIdx))
    },
    [getFlatIndex],
  )

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
  }, [])

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-lg text-muted-foreground">{project.description}</p>
        )}
        <HobbyIdentity hobby={project.hobby} variant="badge" />
      </header>

      {steps.map((step, stepIdx) => (
        <section key={stepIdx} className="space-y-4 pt-4 border-t border-border">
          <h2 className="text-xl font-semibold">{step.name}</h2>

          {step.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {step.images.map((img, imgIdx) => (
                <button
                  key={imgIdx}
                  type="button"
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-lg',
                    'cursor-pointer ring-ring transition-shadow',
                    'hover:ring-2 focus-visible:outline-none focus-visible:ring-2',
                  )}
                  onClick={() => openLightbox(stepIdx, imgIdx)}
                  aria-label={`View ${img.originalFilename ?? `${step.name} image ${imgIdx + 1}`}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.thumbnailUrl || img.displayUrl}
                    alt={img.originalFilename ?? `${step.name} image ${imgIdx + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}

          {step.notes.length > 0 && (
            <div className="space-y-2">
              {step.notes.map((note, i) => (
                <p key={i} className="text-sm text-muted-foreground whitespace-pre-line">
                  {note.text}
                </p>
              ))}
            </div>
          )}
        </section>
      ))}

      {steps.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No steps to display.</p>
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox images={allImages} initialIndex={lightboxIndex} onClose={closeLightbox} />
      )}
    </article>
  )
}
