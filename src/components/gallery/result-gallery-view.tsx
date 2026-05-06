'use client'

import { useState, useCallback } from 'react'
import { AnimatePresence } from 'motion/react'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { ImageSlideshow } from '@/components/gallery/image-slideshow'
import { ImageLightbox } from '@/components/image/image-lightbox'
import type { GalleryImage } from '@/components/image/image-gallery'

interface ResultGalleryViewProps {
  project: {
    name: string
    description: string | null
    hobby: { name: string; color: string; icon: string | null }
    /** Story 30.5 / FR129 — pre-formatted total like `12.5h`, or null to hide. */
    totalHoursLabel: string | null
  }
  images: { displayUrl: string; originalFilename: string | null }[]
}

export function ResultGalleryView({ project, images }: ResultGalleryViewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Story 29.4 / FR124: gallery surfaces now use the unified
  // ImageLightbox with caption metadata per image. Index is used as the
  // synthetic id (stable for the lifetime of the lightbox session).
  const lightboxImages: GalleryImage[] = images.map((img, index) => ({
    id: `result-${index}`,
    displayUrl: img.displayUrl,
    originalFilename: img.originalFilename,
    caption: { title: project.name, description: project.description },
  }))

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
  }, [])

  return (
    <article className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-lg text-muted-foreground">{project.description}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <HobbyIdentity hobby={project.hobby} variant="badge" />
          {project.totalHoursLabel && (
            <span className="text-sm text-muted-foreground" data-testid="gallery-total-hours">
              {project.totalHoursLabel} logged
            </span>
          )}
        </div>
      </header>

      {images.length > 0 ? (
        <>
          <ImageSlideshow images={images} onImageClick={openLightbox} />
          <AnimatePresence>
            {lightboxIndex !== null && (
              <ImageLightbox
                images={lightboxImages}
                initialIndex={lightboxIndex}
                onClose={closeLightbox}
                showDelete={false}
              />
            )}
          </AnimatePresence>
        </>
      ) : (
        <p className="text-center text-muted-foreground py-12">No images available</p>
      )}
    </article>
  )
}
