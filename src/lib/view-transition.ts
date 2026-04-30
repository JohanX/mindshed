/**
 * Story 29.5 / FR124: shared feature-detected wrapper for the
 * Chromium View Transitions API. Used by every lightbox-opening
 * surface (inventory, BOM, gallery — and future ones) so the
 * thumbnail → lightbox morph is consistent and the type cast for the
 * not-yet-standard `document.startViewTransition` lives in one place.
 *
 * Usage at a caller:
 *
 *   import { flushSync } from 'react-dom'
 *   import { runWithViewTransition } from '@/lib/view-transition'
 *
 *   function openLightbox() {
 *     // ...prefetch / fetch images...
 *     runWithViewTransition(() => {
 *       flushSync(() => {
 *         setLightboxImages(images)
 *         setLightboxOpen(true)
 *       })
 *     })
 *   }
 *
 * `flushSync` is critical — the browser snapshots BEFORE/AFTER around
 * the callback, so deferred React renders would miss the "after"
 * snapshot. The call site owns the flushSync (the helper stays
 * unopinionated about how state is committed).
 *
 * On browsers without View Transitions support (Safari, Firefox), the
 * helper just runs the callback directly — the CSS-keyframes fallback
 * (anim-reveal / anim-settle from FR123) drives a clean fade+scale
 * transition instead.
 */

type DocumentWithViewTransitions = Document & {
  startViewTransition?: (callback: () => void) => unknown
}

export function runWithViewTransition(callback: () => void): void {
  if (typeof document === 'undefined') {
    callback()
    return
  }
  const startViewTransition = (document as DocumentWithViewTransitions).startViewTransition
  if (typeof startViewTransition === 'function') {
    startViewTransition.call(document, callback)
  } else {
    callback()
  }
}
