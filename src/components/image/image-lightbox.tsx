'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, ImageIcon, Loader2 } from 'lucide-react'
import { ImageDeleteButton } from '@/components/image/image-delete-button'
import type { GalleryImage } from '@/components/image/image-gallery'
import { useMotionTokens } from '@/lib/motion/motion-tokens'

import {
  determineSwipeAxis,
  evaluateSwipeCommit,
  SWIPE_COMMIT_DISTANCE_THRESHOLD,
  SWIPE_COMMIT_DURATION_MS,
} from '@/components/image/swipe-helpers'

interface ImageLightboxProps {
  images: GalleryImage[]
  initialIndex: number
  onClose: () => void
  showDelete?: boolean
  /**
   * Story 32.3: layout-animation hook for the open/close morph.
   *
   * When set, the INITIALLY-displayed image gets this `layoutId` so
   * Framer's layout system morphs from a thumbnail with the matching
   * layoutId (set by the caller on its source `<motion.img>`).
   * Navigations within the lightbox swap to a per-image layoutId
   * (`lightbox-{imageId}`) which matches no thumbnail — close after a
   * navigation skips the morph (acceptable; the user-facing complaint
   * was the OPEN being brutal, close is secondary).
   *
   * Single-thumbnail callers (inventory hero, BOM row) pass a stable
   * id derived from the entity (e.g. `inventory-hero-{itemId}`) and
   * set the same on their thumbnail.
   *
   * Multi-thumbnail callers (galleries) skip this prop and instead
   * give each gallery thumbnail a per-image `layoutId={`lightbox-${img.id}`}`;
   * the lightbox's per-image fallback matches automatically.
   *
   * The lightbox MUST be rendered inside an `<AnimatePresence>` at the
   * caller level for the close animation to play before unmount.
   */
  morphLayoutId?: string
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
  morphLayoutId,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [broken, setBroken] = useState(false)
  const tokens = useMotionTokens()
  // Story 29.6 (revised): explicit loading state during image swap.
  // Browsers keep the previous <img> visible while the new src loads,
  // which the user perceived as "navigation blocks until prefetched".
  // Reset to true on every navigation; the <img>'s onLoad clears it.
  // Cached images fire onLoad synchronously enough that the spinner
  // flashes only briefly (or not at all).
  const [imageLoading, setImageLoading] = useState(true)

  const total = images.length
  const current = images[currentIndex]

  const goNext = useCallback(() => {
    setBroken(false)
    setImageLoading(true)
    setCurrentIndex((prev) => (prev + 1) % total)
  }, [total])

  const goPrev = useCallback(() => {
    setBroken(false)
    setImageLoading(true)
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

  // Story 29.6 (revised): axis-locked sliding gesture with flick
  // detection.
  //
  //   idle       — no drag; image transform reset
  //   dragging   — finger on screen; once we've moved past the axis-
  //                lock distance the gesture is committed to either
  //                'horizontal' (image follows finger) or 'vertical'
  //                (ignored — let the browser do its thing)
  //   committing — finger lifted past threshold or flicked; image
  //                animates fully off-screen before the index swap
  //
  // Why axis-lock at gesture start (not at endpoint): on mobile the
  // user's finger naturally arcs during a long swipe, so endpoint
  // deltaY can legitimately exceed any reasonable cap. Locking the
  // axis from the first ~8px of motion captures the *intent* — once
  // we know it's a horizontal swipe, vertical drift is irrelevant.
  //
  // Why velocity-based flick detection: distance-only thresholds
  // miss fast flicks that travel <50px. Tracking timestamp at pointer-
  // down lets us compute velocity at pointer-up; a flick (>0.3 px/ms,
  // distance >=20px) commits even when raw distance is below the
  // 50px static threshold.
  //
  // Pointer gate to 'touch' only so mouse-drag doesn't trigger nav.
  type SwipeStart = {
    x: number
    y: number
    pointerId: number
    timestamp: number
    axis: 'horizontal' | 'vertical' | null
    /**
     * Last horizontal delta seen during pointermove. Stored in the ref
     * so `handlePointerCancel` can decide whether to commit (the OS
     * may cancel a gesture that already crossed threshold; honouring
     * the user's intent is better than silently dropping it).
     */
    lastDeltaX: number
  }
  const swipeStartRef = useRef<SwipeStart | null>(null)
  /**
   * Holds the pending slide-out → index-swap timer so we can clear it
   * if the lightbox unmounts (avoids stale-closure goNext on a torn-
   * down component) or if the user cancels mid-commit.
   */
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)

  function clearCommitTimer() {
    if (commitTimerRef.current !== null) {
      clearTimeout(commitTimerRef.current)
      commitTimerRef.current = null
    }
  }

  // Clear any pending commit timer on unmount — fixes the stale-closure
  // race where the user dismisses the lightbox while a swipe is mid-
  // commit and the timer would otherwise call goNext on a torn-down
  // component.
  useEffect(() => {
    return clearCommitTimer
  }, [])

  function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function commitSwipe(direction: -1 | 1) {
    setIsCommitting(true)

    // prefers-reduced-motion: skip the slide-out animation entirely
    // and swap the index synchronously. The CSS-side `--anim-duration-*`
    // tokens are already zeroed under the same media query — JS-side
    // mirrors that contract here.
    if (prefersReducedMotion()) {
      setDragOffset(0)
      setIsCommitting(false)
      if (direction < 0) goNext()
      else goPrev()
      return
    }

    const containerWidth =
      typeof window !== 'undefined' ? window.innerWidth : SWIPE_COMMIT_DISTANCE_THRESHOLD * 8
    setDragOffset(direction * containerWidth)
    clearCommitTimer()
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null
      if (direction < 0) goNext()
      else goPrev()
      setDragOffset(0)
      setIsCommitting(false)
    }, SWIPE_COMMIT_DURATION_MS)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch') return
    if (isCommitting) return // ignore taps mid-commit-animation
    // setPointerCapture: subsequent pointermove / pointerup / pointer-
    // cancel events are routed back to this element even if the finger
    // drags off its bounding rect. Without this, a long swipe near the
    // edge of the dialog can strand the gesture (no further events
    // arrive on the dialog after the finger leaves).
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some platforms / older browsers don't support pointer capture;
      // the gesture still works, just less robustly near edges.
    }
    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      timestamp: event.timeStamp,
      axis: null,
      lastDeltaX: 0,
    }
    setIsDragging(true)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    // No `isDragging` state gate here — the ref's presence is the
    // single source of truth for "are we mid-gesture". Gating on the
    // state value would create a one-frame lag that breaks
    // synchronous pointerdown→pointermove→pointerup sequences.

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y

    // Determine the gesture's dominant axis once we've moved past the
    // lock distance. Mutates the ref in place — the axis decision is
    // sticky for the rest of this gesture.
    if (start.axis === null) {
      const axis = determineSwipeAxis(deltaX, deltaY)
      if (axis === null) return
      start.axis = axis
    }

    // Once locked horizontal, follow the finger. Vertical drift no
    // longer matters — the gesture's intent is established.
    if (start.axis === 'horizontal') {
      start.lastDeltaX = deltaX
      setDragOffset(deltaX)
    }
    // axis === 'vertical' → do nothing; the browser handles it (and
    // touch-action: pan-y on the surface lets it pan naturally).
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    swipeStartRef.current = null
    setIsDragging(false)

    // Not a horizontal gesture — snap back without navigation.
    if (start.axis !== 'horizontal') {
      setDragOffset(0)
      return
    }

    const direction = evaluateSwipeCommit(
      event.clientX - start.x,
      event.timeStamp - start.timestamp,
    )
    if (direction === null) {
      setDragOffset(0)
      return
    }
    commitSwipe(direction)
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    // Cancel arriving mid-commit-animation: leave the timer to finish.
    // The user's commit was already accepted; an OS-level cancel
    // shouldn't undo that.
    if (isCommitting) return

    const start = swipeStartRef.current
    swipeStartRef.current = null
    setIsDragging(false)

    // If the cancel arrives after a horizontal gesture that already
    // crossed the commit threshold, honour it as a commit rather than
    // silently dropping the user's intent. (E.g. browser interrupts
    // mid-flick.)
    if (start && start.axis === 'horizontal') {
      const direction = evaluateSwipeCommit(start.lastDeltaX, event.timeStamp - start.timestamp)
      if (direction !== null) {
        commitSwipe(direction)
        return
      }
    }
    setDragOffset(0)
  }

  if (!current) return null

  // Story 29.6: live swipe drag offset. The Framer `layout` prop is
  // gated off during dragging/committing (see `<motion.img>` below) so
  // the swipe transform doesn't fight Framer's layout-animation system.
  const inlineImageStyle: React.CSSProperties =
    dragOffset !== 0 || isCommitting
      ? {
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging
            ? 'none'
            : `transform var(--anim-duration-medium) var(--anim-easing)`,
        }
      : {}

  // Story 29.6 (revised): the hidden-img prefetch was REMOVED after
  // smoke testing — browsers de-prioritise zero-size hidden images and
  // the prefetch wasn't reliably warming the cache. Worse, navigating
  // showed no loading feedback during the actual fetch (browser kept
  // the previous image visible until the new one arrived, which the
  // user perceived as "the lightbox blocks navigation"). The fix is
  // explicit loading state via `imageLoading` + a Loader2 overlay; the
  // browser's natural fetch on src-change carries the navigation.
  // If/when prefetch becomes worth revisiting, use `Image()` from JS
  // with `fetchPriority: 'high'` rather than a hidden DOM <img>.

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
            // touch-action: `pan-y pinch-zoom` (arbitrary value) — claim
            // horizontal pan for ourselves, but leave vertical pan AND
            // pinch-zoom to the browser. Setting just `pan-y` would
            // block pinch-zoom on the lightbox image — a usability
            // regression for users who want to zoom into details.
            className="anim-lightbox-content relative flex h-[100dvh] w-screen max-w-full touch-[pan-y_pinch-zoom] flex-col items-center justify-center gap-0 rounded-none border-none bg-black/95 p-0 outline-none sm:h-auto sm:max-h-[90vh] sm:w-auto sm:max-w-[90vw] sm:rounded-md sm:bg-transparent"
            // Story 29.6: swipe gesture on touch devices — left = next,
            // right = prev. Coexists with on-screen arrows + keyboard.
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
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
              <div className="relative flex flex-1 items-center justify-center min-h-0 w-full sm:flex-none">
                {broken ? (
                  <div className="flex flex-col items-center gap-2 text-white/60">
                    <ImageIcon className="h-16 w-16" />
                    <p className="text-sm">Image could not be loaded</p>
                  </div>
                ) : (
                  <>
                    {/* Story 32.3: motion.img with `layoutId` keyed by
                        the image's stable id + a per-caller context
                        suffix. The matching `layoutId` on the source
                        thumbnail (set in each caller's <motion.img>)
                        morphs from thumbnail position to lightbox
                        position. Layout is gated OFF during swipe
                        gestures so the inline transform from Story
                        29.6 doesn't fight Framer's layout system. */}
                    <motion.img
                      key={current.id}
                      // For the initially-shown image, use morphLayoutId
                      // when set (single-thumbnail callers); otherwise
                      // fall back to per-image id (multi-thumbnail
                      // gallery callers). After navigation, switch to
                      // per-image id (which won't match anything; close
                      // post-nav skips the morph as documented).
                      layoutId={
                        currentIndex === initialIndex && morphLayoutId
                          ? morphLayoutId
                          : `lightbox-${current.id}`
                      }
                      layout={!isDragging && !isCommitting}
                      transition={tokens.transitions.layout}
                      ref={(node) => {
                        // Cached-image race: if the browser already had
                        // this URL in cache, `onLoad` may have fired
                        // before React attached its listener — leaving
                        // `imageLoading` stuck at true. Check `complete`
                        // synchronously on attach and clear if the image
                        // is already decoded.
                        if (node && node.complete && node.naturalWidth > 0) {
                          setImageLoading(false)
                        }
                      }}
                      src={current.displayUrl}
                      alt={current.originalFilename ?? ''}
                      className="max-h-full max-w-full object-contain sm:max-h-[90vh] sm:max-w-[90vw]"
                      style={inlineImageStyle}
                      onLoad={() => setImageLoading(false)}
                      onError={() => {
                        setBroken(true)
                        setImageLoading(false)
                      }}
                      data-testid="lightbox-image"
                    />
                    {imageLoading && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none"
                        aria-hidden="true"
                        data-testid="lightbox-image-loading"
                      >
                        <Loader2 className="h-10 w-10 animate-spin text-white/80" />
                      </div>
                    )}
                  </>
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
