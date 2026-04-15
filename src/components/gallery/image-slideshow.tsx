'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageSlideshowProps {
  images: { displayUrl: string; originalFilename: string | null }[]
}

export function ImageSlideshow({ images }: ImageSlideshowProps) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const total = images.length

  const goNext = useCallback(() => {
    setCurrent(i => (i + 1) % total)
  }, [total])

  const goPrev = useCallback(() => {
    setCurrent(i => (i - 1 + total) % total)
  }, [total])

  // Auto-advance every 5s, pause on interaction
  useEffect(() => {
    if (paused || total <= 1) return
    timerRef.current = setInterval(goNext, 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, goNext, total])

  function handleInteraction() {
    setPaused(true)
    // Resume after 10s of no interaction
    setTimeout(() => setPaused(false), 10000)
  }

  if (total === 0) return null

  const img = images[current]

  return (
    <div className="space-y-4" onPointerDown={handleInteraction}>
      {/* Main image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
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
              onClick={(e) => { e.stopPropagation(); goPrev(); handleInteraction() }}
              aria-label="Previous image"
              data-testid="slideshow-prev"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-black/40 text-white hover:bg-black/60"
              onClick={(e) => { e.stopPropagation(); goNext(); handleInteraction() }}
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
              onClick={() => { setCurrent(i); handleInteraction() }}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
