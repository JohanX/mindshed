'use client'

import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, ImageIcon } from 'lucide-react'
import { ImageUploadButton } from '@/components/image/image-upload-button'
import { ImageLinkInput } from '@/components/image/image-link-input'
import { ImageLightbox } from '@/components/image/image-lightbox'
import { ImageDeleteButton } from '@/components/image/image-delete-button'
import { useMotionTokens } from '@/lib/motion/motion-tokens'
import { cn } from '@/lib/utils'

export interface GalleryImage {
  id: string
  displayUrl: string
  thumbnailUrl?: string
  originalFilename: string | null
  /**
   * Story 29.4 / FR124: optional caption block rendered below the image
   * inside `ImageLightbox`. Used by gallery surfaces (result + journey
   * views) to show step-name + description; non-gallery callers
   * (inventory, idea, BOM) leave this undefined and no caption renders.
   */
  caption?: {
    title?: string
    description?: string | null
  }
}

interface ImageGalleryProps {
  images: GalleryImage[]
  stepId: string
}

function BrokenImagePlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <ImageIcon className="h-8 w-8 text-muted-foreground" />
    </div>
  )
}

export function ImageGallery({ images, stepId }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const tokens = useMotionTokens()

  const handleImageError = useCallback((imageId: string) => {
    setBrokenImages((prev) => new Set(prev).add(imageId))
  }, [])

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
  }, [])

  if (images.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border p-8 text-center"
        data-testid="image-gallery-empty"
      >
        <Camera className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Add photos to document your progress</p>
        <div className="flex flex-wrap items-center gap-2">
          <ImageUploadButton stepId={stepId} />
          <ImageLinkInput stepId={stepId} />
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
        data-testid="image-gallery"
      >
        {images.map((image, index) => (
          <div key={image.id} className="group relative aspect-square">
            <button
              type="button"
              className={cn(
                'relative h-full w-full overflow-hidden rounded-xl',
                'cursor-pointer ring-ring transition-shadow',
                'hover:ring-2 focus-visible:outline-none focus-visible:ring-2',
              )}
              onClick={() => openLightbox(index)}
              aria-label={`View ${image.originalFilename ?? `image ${index + 1}`}`}
            >
              {brokenImages.has(image.id) ? (
                <BrokenImagePlaceholder />
              ) : (
                // Story 32.3: layoutId matches lightbox per-image fallback
                // (`lightbox-{img.id}`) so open/close morphs play.
                <motion.img
                  layoutId={`lightbox-${image.id}`}
                  transition={tokens.transitions.layout}
                  src={image.thumbnailUrl || image.displayUrl}
                  alt={image.originalFilename ?? ''}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={() => handleImageError(image.id)}
                />
              )}
            </button>
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ImageDeleteButton
                imageId={image.id}
                className="h-8 w-8 rounded-full bg-black/60 hover:bg-destructive text-white shadow-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <ImageLightbox images={images} initialIndex={lightboxIndex} onClose={closeLightbox} />
        )}
      </AnimatePresence>
    </>
  )
}
