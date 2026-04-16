'use client'

import { useState, useCallback } from 'react'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { ImageSlideshow } from '@/components/gallery/image-slideshow'
import { GalleryLightbox, type GalleryLightboxImage } from '@/components/gallery/gallery-lightbox'

interface ResultGalleryViewProps {
  project: {
    name: string
    description: string | null
    hobby: { name: string; color: string; icon: string | null }
  }
  images: { displayUrl: string; originalFilename: string | null }[]
}

export function ResultGalleryView({ project, images }: ResultGalleryViewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const lightboxImages: GalleryLightboxImage[] = images.map((img) => ({
    displayUrl: img.displayUrl,
    originalFilename: img.originalFilename,
    stepName: project.name,
    description: project.description,
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
        <div className="flex justify-center">
          <HobbyIdentity hobby={project.hobby} variant="badge" />
        </div>
      </header>

      {images.length > 0 ? (
        <>
          <ImageSlideshow images={images} onImageClick={openLightbox} />
          {lightboxIndex !== null && (
            <GalleryLightbox
              images={lightboxImages}
              initialIndex={lightboxIndex}
              onClose={closeLightbox}
            />
          )}
        </>
      ) : (
        <p className="text-center text-muted-foreground py-12">No images available</p>
      )}
    </article>
  )
}
