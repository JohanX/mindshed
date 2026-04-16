'use client'

import { useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, ImageIcon } from 'lucide-react'
import { VisuallyHidden } from 'radix-ui'

export interface GalleryLightboxImage {
  displayUrl: string
  originalFilename: string | null
  stepName: string
  description?: string | null
}

interface GalleryLightboxProps {
  images: GalleryLightboxImage[]
  initialIndex: number
  onClose: () => void
}

export function GalleryLightbox({ images, initialIndex, onClose }: GalleryLightboxProps) {
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
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev])

  if (!current) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col items-center justify-center gap-0 rounded-none border-none bg-black/95 p-0 sm:max-w-full"
      >
        <VisuallyHidden.Root>
          <DialogTitle>
            {current.stepName} — Image {currentIndex + 1} of {total}
          </DialogTitle>
        </VisuallyHidden.Root>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 z-10 h-11 w-11 text-white hover:bg-white/20"
          onClick={onClose}
          aria-label="Close lightbox"
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Counter */}
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
          {currentIndex + 1} of {total}
        </div>

        {/* Image */}
        <div className="flex h-full w-full flex-col items-center justify-center px-12 pt-12 pb-4">
          <div className="flex flex-1 items-center justify-center min-h-0 w-full">
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
              />
            )}
          </div>

          {/* Caption: step name + description */}
          <div className="w-full max-w-2xl text-center pt-3 pb-2 shrink-0">
            <p className="text-white text-sm font-medium">{current.stepName}</p>
            {current.description && (
              <p className="text-white/60 text-xs mt-1 line-clamp-2">{current.description}</p>
            )}
          </div>
        </div>

        {/* Navigation arrows */}
        {total > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2 text-white hover:bg-white/20"
              onClick={goPrev}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2 text-white hover:bg-white/20"
              onClick={goNext}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
