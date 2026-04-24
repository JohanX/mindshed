'use client'

import { useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, ImageIcon } from 'lucide-react'
import { VisuallyHidden } from 'radix-ui'
import { ImageDeleteButton } from '@/components/image/image-delete-button'
import type { GalleryImage } from '@/components/image/image-gallery'

interface ImageLightboxProps {
  images: GalleryImage[]
  initialIndex: number
  onClose: () => void
  showDelete?: boolean
}

export function ImageLightbox({ images, initialIndex, onClose, showDelete = true }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [broken, setBroken] = useState(false)

  const total = images.length
  const current = images[currentIndex]

  const goNext = useCallback(() => {
    setBroken(false)
    setCurrentIndex((i) => (i + 1) % total)
  }, [total])

  const goPrev = useCallback(() => {
    setBroken(false)
    setCurrentIndex((i) => (i - 1 + total) % total)
  }, [total])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev])

  if (!current) return null

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col items-center justify-center gap-0 rounded-none border-none bg-black/95 p-0 sm:max-w-full"
        data-testid="image-lightbox"
      >
        <VisuallyHidden.Root>
          <DialogTitle>
            Image {currentIndex + 1} of {total}
          </DialogTitle>
        </VisuallyHidden.Root>

        {/* Top-right controls: delete + close */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          {showDelete && (
            <ImageDeleteButton
              imageId={current.id}
              className="h-11 w-11 rounded-full bg-white/10 hover:bg-destructive text-white"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-white hover:bg-white/20"
            onClick={onClose}
            aria-label="Close lightbox"
            data-testid="lightbox-close"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Image counter */}
        <div
          className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white"
          data-testid="lightbox-counter"
        >
          {currentIndex + 1} of {total}
        </div>

        {/* Main image */}
        <div className="flex h-full w-full items-center justify-center p-12">
          {broken ? (
            <div className="flex flex-col items-center gap-2 text-white/60">
              <ImageIcon className="h-16 w-16" />
              <p className="text-sm">Image could not be loaded</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.displayUrl}
              alt={current.originalFilename ?? ''}
              className="max-h-full max-w-full object-contain"
              onError={() => setBroken(true)}
              data-testid="lightbox-image"
            />
          )}
        </div>

        {/* Previous arrow */}
        {total > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={goPrev}
            aria-label="Previous image"
            data-testid="lightbox-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}

        {/* Next arrow */}
        {total > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={goNext}
            aria-label="Next image"
            data-testid="lightbox-next"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
