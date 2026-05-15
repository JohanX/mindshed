'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'

interface ImageSlideshowProps {
  images: {
    displayUrl: string
    originalFilename: string | null
    // Story 35.4 / FR137 — optional video metadata. Undefined = implicit
    // IMAGE (back-compat). VIDEO items render the poster + play overlay
    // at slideshow-size; tap goes to the lightbox where `<video>` mounts.
    mediaType?: 'IMAGE' | 'VIDEO'
    posterUrl?: string | null
  }[]
  onImageClick?: (index: number) => void
}

export function ImageSlideshow({ images, onImageClick }: ImageSlideshowProps) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const total = images.length

  const goNext = useCallback(() => {
    setCurrent((i) => (i + 1) % total)
  }, [total])

  const goPrev = useCallback(() => {
    setCurrent((i) => (i - 1 + total) % total)
  }, [total])

  // Auto-advance every 5s, pause on interaction
  useEffect(() => {
    if (paused || total <= 1) return
    intervalRef.current = setInterval(goNext, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [paused, goNext, total])

  // Cleanup resume timeout on unmount
  useEffect(() => {
    return () => {
      if (resumeRef.current) clearTimeout(resumeRef.current)
    }
  }, [])

  function handleInteraction() {
    setPaused(true)
    if (resumeRef.current) clearTimeout(resumeRef.current)
    resumeRef.current = setTimeout(() => setPaused(false), 10000)
  }

  if (total === 0) return null

  const img = images[current]

  return (
    <div className="space-y-4" onPointerDown={handleInteraction}>
      {/* Main image */}
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted${onImageClick ? ' cursor-pointer' : ''}`}
        onClick={() => onImageClick?.(current)}
        role={onImageClick ? 'button' : undefined}
        tabIndex={onImageClick ? 0 : undefined}
        // Story 35.4 code-review patch (Blind Hunter #1): aria-label
        // distinguishes VIDEO from IMAGE so screen-reader users hear
        // the right affordance — "Play" for video, "View" for image.
        aria-label={
          onImageClick
            ? img.mediaType === 'VIDEO'
              ? `Play ${img.originalFilename ?? `video ${current + 1}`} in fullscreen`
              : `View ${img.originalFilename ?? `image ${current + 1}`} fullscreen`
            : undefined
        }
        onKeyDown={
          onImageClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onImageClick(current)
                }
              }
            : undefined
        }
      >
        {/* Story 35.4 / FR137 — VIDEO at slideshow size renders poster
            + play overlay (Cloudinary) or generic play-icon card (S3
            null poster). NO `<video>` element at slideshow size; the
            user taps to open the lightbox where `<video>` mounts. */}
        {img.mediaType === 'VIDEO' ? (
          <div className="relative h-full w-full bg-muted">
            {img.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img.posterUrl}
                alt={img.originalFilename ?? `Video ${current + 1}`}
                className="h-full w-full object-contain"
                data-testid="slideshow-image"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center bg-muted"
                data-testid="slideshow-image"
              >
                <Play className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              data-testid="video-play-overlay"
            >
              <div className="rounded-full bg-black/60 p-4">
                <Play className="h-10 w-10 fill-white text-white" />
              </div>
            </div>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.displayUrl}
            alt={img.originalFilename ?? `Image ${current + 1}`}
            className="h-full w-full object-contain"
            data-testid="slideshow-image"
          />
        )}

        {total > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/40 text-white hover:bg-black/60"
              onClick={(e) => {
                e.stopPropagation()
                goPrev()
                handleInteraction()
              }}
              aria-label="Previous image"
              data-testid="slideshow-prev"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/40 text-white hover:bg-black/60"
              onClick={(e) => {
                e.stopPropagation()
                goNext()
                handleInteraction()
              }}
              aria-label="Next image"
              data-testid="slideshow-next"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}
      </div>

      {/* Dot indicators */}
      {total > 1 && (
        <div className="flex justify-center gap-1.5" data-testid="slideshow-dots">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`h-2 w-2 rounded-full transition-colors ${i === current ? 'bg-foreground' : 'bg-foreground/25'}`}
              onClick={() => {
                setCurrent(i)
                handleInteraction()
              }}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
