'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageSlideshowProps {
  images: { displayUrl: string; originalFilename: string | null }[]
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
        aria-label={
          onImageClick
            ? `View ${img.originalFilename ?? `image ${current + 1}`} fullscreen`
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.displayUrl}
          alt={img.originalFilename ?? `Image ${current + 1}`}
          className="h-full w-full object-contain"
          data-testid="slideshow-image"
        />

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
