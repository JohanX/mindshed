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

  // Story 34.4 / FR133 — prefetch the next + previous images so a
  // Next/Prev click usually hits the browser cache. JS-side `Image()`
  // (constructor) issues a real network request the browser caches the
  // same way it would for a regular `<img src>`; this avoids the
  // hidden-DOM-img failure mode an earlier (Story 29.6) attempt hit
  // (browsers de-prioritise zero-size hidden imgs regardless of the
  // `loading` attribute, so the cache wasn't reliably warm). The
  // detached HTMLImageElement is GC-eligible after this effect returns;
  // the browser keeps the cached response independently of the JS ref.
  //
  // Indices wrap modulo `total` to match `goNext`/`goPrev`'s
  // wrap-around navigation — clicking Next from the last image lands
  // on index 0, so we should prefetch index 0 from the last image too.
  //
  // `fetchPriority: 'low'` (NOT 'high') because this is a SPECULATIVE
  // prefetch — high-priority would preempt the bandwidth of the
  // currently-viewed image (which itself may not be fully loaded yet).
  // 'low' tells the browser "warm the cache when you have idle
  // capacity, but don't compete with foreground requests". Older
  // browsers ignore the hint — graceful degradation.
  useEffect(() => {
    if (total < 2) return
    const indicesToPrefetch = [(currentIndex + 1) % total, (currentIndex - 1 + total) % total]
    for (const index of indicesToPrefetch) {
      const url = images[index]?.displayUrl
      if (!url) continue
      const img = new window.Image()
      ;(
        img as HTMLImageElement & {
          fetchPriority?: 'high' | 'low' | 'auto'
        }
      ).fetchPriority = 'low'
      img.src = url
    }
  }, [currentIndex, images, total])

  // Story 34.4 / FR133 — last-rendered bounding box of the inner img,
  // captured in `onLoad` as state (NOT a ref — React 19's
  // react-hooks/refs rule prohibits reading ref.current during render,
  // which is exactly what the consumer below needs to do). Used as
  // min-width/min-height on the image-area div while `imageLoading` is
  // true so DialogContent (sized to its content via `sm:w-auto
  // sm:h-auto` on desktop) doesn't visibly collapse during the natural
  // fetch on Next/Prev — keeping the image area at the previous
  // photo's footprint avoids a jarring shrink-then-grow as the new
  // image loads. Issue #19 made the controls' layout independent of
  // Content's size (they're `fixed` to the viewport now), so this
  // stabilization no longer affects control placement — but it still
  // matters for the image area itself. The extra render-per-onLoad is
  // negligible (fires once per image, batched with
  // `setImageLoading(false)`).
  const [lastImageBox, setLastImageBox] = useState<{
    width: number
    height: number
  } | null>(null)

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

  // Story 34.4 / FR133 — historical context: Story 29.6 originally
  // shipped a hidden-DOM-`<img>` prefetch but it was REMOVED in the
  // post-29.6 follow-up because browsers de-prioritise zero-size hidden
  // imgs (Chromium specifically: hidden imgs get scheduled at 'low'
  // priority regardless of the `loading` attribute), so the cache
  // wasn't reliably warm by the time the user clicked Next. The
  // current implementation uses the JS-side `Image()` constructor in a
  // `useEffect` near the top of this component (search for "Story 34.4
  // / FR133 — prefetch") which issues a real network request the
  // browser caches normally; subsequent `<img src=...>` requests for
  // the same URL hit the cache. Pair-fix: a `useRef` holds the
  // previous image's rendered bounding box and is applied as
  // min-width/min-height on the image-area div while `imageLoading` is
  // true, so DialogContent doesn't collapse during the natural fetch
  // on cold-cache navigations.

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
            // Issue #19 — suppress Radix's auto-focus on open. Without
            // this, the first focusable inside Content (the close
            // button) gets a programmatic .focus() that browsers match
            // as `:focus-visible`, so opening the lightbox by mouse
            // showed an orange focus ring on close. Tab into the
            // dialog still works (Radix's focus trap is still active
            // on Tab); keyboard users see rings as intended on real
            // keyboard nav.
            onOpenAutoFocus={(event) => event.preventDefault()}
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

            {/* Issue #19 — controls are positioned with `fixed`
                (relative to the viewport), NOT `absolute` (which would
                resolve relative to the shrunk DialogContent and put
                them on top of small images). Controls remain DOM
                children of Content so:
                  • Radix's outside-click logic correctly treats them
                    as inside (no `onPointerDownOutside` workaround
                    needed),
                  • Radix's `aria-hidden` modal management leaves them
                    visible to screen readers (only siblings of
                    Content inside Portal get marked aria-hidden),
                  • the focus trap covers them naturally.

                The lightbox open/close keyframes (`anim-lightbox-*`,
                see globals.css) are defined opacity-only (no
                `transform: scale`) precisely so this `fixed`
                positioning resolves to the viewport throughout the
                animation. A `transform` on Content would establish a
                new containing block for `fixed` descendants and the
                buttons would visibly jump to the viewport edges at
                end-of-animation.

                For the prev/next arrows the `-translate-y-1/2` lives
                on the wrapper div, NOT on the Button itself. Tailwind
                v4 stores translate-x and translate-y in a single CSS
                variable; applying `-translate-y-1/2` (centering) AND
                `active:translate-y-px` (the Button's press cue) on
                the same element makes the press REPLACE the
                centering, dropping the button by ~22 px on press —
                and the cursor lands on empty space, so slow clicks
                stop firing. Splitting transforms onto two elements
                composes cleanly. */}

            {/* Top-right controls: delete + close */}
            <div className="fixed right-3 top-3 z-50 flex items-center gap-2">
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
              className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white"
              data-testid="lightbox-counter"
            >
              {currentIndex + 1} of {total}
            </div>

            {/* Main image. Mobile fills the viewport with padding; desktop
                hugs the image (the image is the size driver). */}
            <div className="flex h-full w-full flex-col items-center justify-center p-12 sm:h-auto sm:w-auto sm:p-0">
              <div
                className="relative flex flex-1 items-center justify-center min-h-0 w-full sm:flex-none"
                // Story 34.4 / FR133 — while the new image is loading,
                // hold this div at the previous image's rendered size so
                // DialogContent doesn't collapse (sm:w-auto sm:h-auto
                // sizes to content on desktop). Once the new image
                // loads, `onLoad` updates the ref and `imageLoading`
                // flips to false → the inline style drops, natural
                // sizing takes over. First lightbox open (ref still
                // null) preserves the existing collapse-then-expand
                // behaviour — typical use is "open then navigate" so
                // the expensive case is the navigation, not the open.
                style={
                  imageLoading && lastImageBox
                    ? {
                        minWidth: lastImageBox.width,
                        minHeight: lastImageBox.height,
                      }
                    : undefined
                }
              >
                {broken ? (
                  <div className="flex flex-col items-center gap-2 text-white/60">
                    <ImageIcon className="h-16 w-16" />
                    <p className="text-sm">Image could not be loaded</p>
                  </div>
                ) : (
                  <>
                    {/* Story 34.1 (FR132): motion.div wrapper drives the
                        layoutId morph reveal (Story 32.3); the inner
                        <img> holds Story 29.6's swipe `translateX`
                        inline style uncontested by Framer's projection.
                        Splitting the two transforms onto separate DOM
                        nodes lets them compose visually (CSS transforms
                        cascade parent → child) instead of fighting on
                        the same `style.transform` attribute. The
                        `layout={!isDragging && !isCommitting}` gate is
                        kept as defence in depth; the primary fix is the
                        nesting. */}
                    <motion.div
                      key={current.id}
                      // For the initially-shown image, use morphLayoutId
                      // when set (single-thumbnail callers); otherwise
                      // fall back to per-image id (multi-thumbnail
                      // gallery callers). After navigation, switch to
                      // per-image id (which won't match anything; close
                      // post-nav skips the morph as documented).
                      // Framer's layoutId matches across element types
                      // (motion.img source thumbnail ↔ motion.div
                      // target wrapper) — the morph is bbox-driven, not
                      // element-typed.
                      layoutId={
                        currentIndex === initialIndex && morphLayoutId
                          ? morphLayoutId
                          : `lightbox-${current.id}`
                      }
                      layout={!isDragging && !isCommitting}
                      transition={tokens.transitions.layout}
                      className="inline-flex max-h-full max-w-full sm:max-h-[90vh] sm:max-w-[90vw]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
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
                        className="block max-h-full max-w-full object-contain"
                        style={inlineImageStyle}
                        onLoad={(event) => {
                          // Story 34.4 / FR133 — capture the rendered
                          // bbox (post-clip to max-h-[90vh] /
                          // max-w-[90vw], not raw naturalWidth/Height)
                          // so the next navigation can stabilize the
                          // image-area div's size while the new image
                          // loads. See the image-area div's `style`
                          // prop above for the consumer.
                          const rect = event.currentTarget.getBoundingClientRect()
                          if (rect.width > 0 && rect.height > 0) {
                            setLastImageBox({
                              width: rect.width,
                              height: rect.height,
                            })
                          }
                          setImageLoading(false)
                        }}
                        onError={() => {
                          setBroken(true)
                          setImageLoading(false)
                        }}
                        data-testid="lightbox-image"
                      />
                    </motion.div>
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
              <div className="fixed left-3 top-1/2 z-50 -translate-y-1/2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full bg-black/50 supports-backdrop-filter:backdrop-blur-sm text-white hover:bg-black/70"
                  onClick={goPrev}
                  aria-label="Previous image"
                  data-testid="lightbox-prev"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              </div>
            )}

            {/* Next arrow */}
            {total > 1 && (
              <div className="fixed right-3 top-1/2 z-50 -translate-y-1/2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full bg-black/50 supports-backdrop-filter:backdrop-blur-sm text-white hover:bg-black/70"
                  onClick={goNext}
                  aria-label="Next image"
                  data-testid="lightbox-next"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
