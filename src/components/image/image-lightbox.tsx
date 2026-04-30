'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, ImageIcon } from 'lucide-react'
import { ImageDeleteButton } from '@/components/image/image-delete-button'
import type { GalleryImage } from '@/components/image/image-gallery'

// Story 29.6 / FR124: swipe gesture thresholds.
// HORIZONTAL_THRESHOLD: minimum X displacement to count as a swipe.
// VERTICAL_THRESHOLD: maximum Y displacement allowed — beyond this we
// treat the gesture as a vertical scroll/drag attempt and ignore.
const SWIPE_HORIZONTAL_THRESHOLD = 50
const SWIPE_VERTICAL_THRESHOLD = 30

interface ImageLightboxProps {
  images: GalleryImage[]
  initialIndex: number
  onClose: () => void
  showDelete?: boolean
  /**
   * Story 29.1 / FR123: when set, the lightbox's currently-displayed
   * `<img>` gets `view-transition-name: <viewTransitionName>` as an
   * inline style. Pair it with a matching `viewTransitionName` on the
   * source thumbnail and wrap the open/close in
   * `document.startViewTransition(...)` at the caller — the Chromium
   * View Transitions API then morphs between the two for the open
   * transition. On browsers without view-transition support, the
   * inline style is harmless (unknown CSS property) and the standard
   * fade+scale CSS keyframes take over.
   *
   * Each caller must use a unique value (e.g., 'inv-hero-' + item.id)
   * so multiple lightboxes on a page never collide on the name. The
   * lightbox sets it ONLY on the initially-shown image; subsequent
   * navigations (next/prev arrows) don't morph (acceptable trade —
   * the morph belongs to the open transition, not navigation).
   */
  viewTransitionName?: string
}

/**
 * Story 29.1: the lightbox uses Radix Dialog primitives DIRECTLY rather
 * than the project's shared `DialogContent` wrapper because the lightbox
 * needs a darker, blurred overlay (`bg-black/80 backdrop-blur-sm`) that
 * the shared wrapper's standard `bg-black/10` overlay can't provide.
 * Story 29.2's general dialog sweep keeps the standard overlay; this
 * customisation is lightbox-only.
 */
export function ImageLightbox({
  images,
  initialIndex,
  onClose,
  showDelete = true,
  viewTransitionName,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [broken, setBroken] = useState(false)

  const total = images.length
  const current = images[currentIndex]

  const goNext = useCallback(() => {
    setBroken(false)
    setCurrentIndex((prev) => (prev + 1) % total)
  }, [total])

  const goPrev = useCallback(() => {
    setBroken(false)
    setCurrentIndex((prev) => (prev - 1 + total) % total)
  }, [total])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev])

  // Story 29.6 / FR124: pointer-event-driven swipe handler. Tracks the
  // touch's start coordinates per-pointer-id; on pointerup, if the
  // gesture exceeds the horizontal threshold AND stays under the
  // vertical threshold, navigate. Gated to `pointerType === 'touch'`
  // so mouse-drag on the image doesn't accidentally trigger navigation
  // (mouse users have the on-screen arrow buttons + keyboard).
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch') return
    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    swipeStartRef.current = null

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaY) > SWIPE_VERTICAL_THRESHOLD) return // vertical scroll attempt
    if (Math.abs(deltaX) < SWIPE_HORIZONTAL_THRESHOLD) return // not a real swipe

    // Swipe LEFT (deltaX negative) → next image.
    // Swipe RIGHT (deltaX positive) → previous image.
    if (deltaX < 0) {
      goNext()
    } else {
      goPrev()
    }
  }

  function handlePointerCancel() {
    swipeStartRef.current = null
  }

  if (!current) return null

  // Only morph the originally-clicked image; navigations don't carry the
  // view-transition name (the open transition is the moment that earns
  // the morph; arrow navigation is a different motion, future story).
  const isOriginalImage = currentIndex === initialIndex
  const inlineImageStyle =
    viewTransitionName && isOriginalImage ? { viewTransitionName } : undefined

  // Story 29.6 / FR124: next-image prefetch. Render a hidden eager-
  // loading <img> for `images[currentIndex + 1]` so the first forward
  // swipe lands on a cached image instead of a blank/loading state.
  // Backward prefetch is intentionally out of scope — the previous
  // image is usually already in browser cache after first viewing.
  const nextImage = currentIndex + 1 < total ? images[currentIndex + 1] : null

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        {/* Story 29.1: scroll container + dimmed/blurred backdrop. On
            desktop the content shrinks to wrap the image, so this
            overlay's surrounding area becomes the click-to-close target
            naturally. Mobile keeps the same behaviour as before — the
            content fills the viewport, so the overlay is mostly hidden
            beneath. */}
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className="anim-lightbox-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 supports-backdrop-filter:backdrop-blur-sm"
        >
          <DialogPrimitive.Content
            data-slot="dialog-content"
            data-testid="image-lightbox"
            // Mobile (`< sm`): full-viewport — the dark content IS the lightbox.
            // Desktop (`sm+`): content shrinks to wrap the image (transparent;
            // overlay around it is the dim backdrop + click-to-close target).
            className="anim-lightbox-content relative flex h-[100dvh] w-screen max-w-full flex-col items-center justify-center gap-0 rounded-none border-none bg-black/95 p-0 outline-none sm:h-auto sm:max-h-[90vh] sm:w-auto sm:max-w-[90vw] sm:rounded-md sm:bg-transparent"
            // Story 29.6: swipe gesture on touch devices — left = next,
            // right = prev. Coexists with on-screen arrows + keyboard.
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            <VisuallyHidden.Root>
              <DialogPrimitive.Title>
                Image {currentIndex + 1} of {total}
              </DialogPrimitive.Title>
            </VisuallyHidden.Root>

            {/* Top-right controls: delete + close */}
            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              {showDelete && (
                <ImageDeleteButton
                  imageId={current.id}
                  className="h-11 w-11 rounded-full bg-black/50 supports-backdrop-filter:backdrop-blur-sm text-white hover:bg-destructive"
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full bg-black/50 supports-backdrop-filter:backdrop-blur-sm text-white hover:bg-black/70"
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

            {/* Main image. Mobile fills the viewport with padding; desktop
                hugs the image (the image is the size driver). */}
            <div className="flex h-full w-full flex-col items-center justify-center p-12 sm:h-auto sm:w-auto sm:p-0">
              <div className="flex flex-1 items-center justify-center min-h-0 w-full sm:flex-none">
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
                    className="max-h-full max-w-full object-contain sm:max-h-[90vh] sm:max-w-[90vw]"
                    style={inlineImageStyle}
                    onError={() => setBroken(true)}
                    data-testid="lightbox-image"
                  />
                )}
              </div>

              {/* Story 29.4 / FR124: caption block (gallery callers
                  pass current.caption; non-gallery callers don't, and
                  no caption renders). */}
              {current.caption && (
                <div
                  className="w-full max-w-2xl text-center pt-3 pb-2 shrink-0"
                  data-testid="lightbox-caption"
                >
                  {current.caption.title && (
                    <p className="text-white text-sm font-medium">{current.caption.title}</p>
                  )}
                  {current.caption.description && (
                    <p className="text-white/60 text-xs mt-1 line-clamp-2">
                      {current.caption.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Story 29.6: hidden eager-loading prefetch for the next
                image so the first forward swipe doesn't hit a blank
                state. Positioned absolutely + tiny + invisible so it
                doesn't affect layout, capture clicks, or appear to
                screen readers. */}
            {nextImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={nextImage.displayUrl}
                alt=""
                aria-hidden="true"
                loading="eager"
                className="pointer-events-none absolute h-px w-px opacity-0"
                data-testid="lightbox-prefetch-next"
              />
            )}

            {/* Previous arrow */}
            {total > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full bg-black/50 supports-backdrop-filter:backdrop-blur-sm text-white hover:bg-black/70"
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
                className="absolute right-3 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full bg-black/50 supports-backdrop-filter:backdrop-blur-sm text-white hover:bg-black/70"
                onClick={goNext}
                aria-label="Next image"
                data-testid="lightbox-next"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
