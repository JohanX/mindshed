/**
 * Pure-logic helpers extracted from the image-lightbox swipe gesture
 * (Story 29.6 / FR124 + post-ship axis-lock + flick fixes).
 *
 * Lives here so the threshold logic is unit-testable without spinning
 * up a full React component + synthetic PointerEvents. The lightbox
 * component reads these constants and calls these functions; behaviour
 * stays identical to the inline version.
 */

/** Minimum any-direction motion before we commit to an axis. */
export const SWIPE_AXIS_LOCK_DISTANCE = 8

/** Raw horizontal distance that always commits a swipe. */
export const SWIPE_COMMIT_DISTANCE_THRESHOLD = 50

/** Velocity (px/ms) above which a short swipe is treated as a flick. */
export const SWIPE_FLICK_VELOCITY_THRESHOLD = 0.3

/** Minimum distance for a flick to count, paired with the velocity check. */
export const SWIPE_FLICK_DISTANCE_THRESHOLD = 20

/** Slide-out animation duration in ms; mirrors `--anim-duration-medium`. */
export const SWIPE_COMMIT_DURATION_MS = 220

/**
 * Decide the gesture's dominant axis once it's moved past the lock
 * distance. Returns:
 * - `'horizontal'` when |deltaX| > |deltaY| AND at least one axis is
 *   past the lock distance,
 * - `'vertical'` when |deltaY| >= |deltaX| AND at least one axis is
 *   past the lock distance,
 * - `null` when neither axis has moved past the lock distance — the
 *   gesture is still pending an intent.
 *
 * Equal-magnitude deltas resolve to vertical so a perfectly diagonal
 * gesture defers to the browser's vertical-pan handling.
 */
export function determineSwipeAxis(
  deltaX: number,
  deltaY: number,
): 'horizontal' | 'vertical' | null {
  if (Math.abs(deltaX) < SWIPE_AXIS_LOCK_DISTANCE && Math.abs(deltaY) < SWIPE_AXIS_LOCK_DISTANCE) {
    return null
  }
  return Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
}

/**
 * Decide whether a horizontal-axis-locked gesture meets the commit
 * threshold (distance OR flick). Returns the swipe direction
 * (-1 = next / leftward swipe, 1 = prev / rightward swipe) or `null`
 * when the gesture should snap back without navigation.
 *
 * Caller is responsible for guarding against non-horizontal gestures
 * — this fn assumes `deltaX` is the horizontal delta of an already-
 * locked-horizontal gesture.
 */
export function evaluateSwipeCommit(deltaX: number, elapsedMs: number): -1 | 1 | null {
  if (deltaX === 0) return null
  const elapsed = Math.max(1, elapsedMs)
  const velocity = Math.abs(deltaX) / elapsed
  const meetsDistance = Math.abs(deltaX) >= SWIPE_COMMIT_DISTANCE_THRESHOLD
  const isFlick =
    velocity >= SWIPE_FLICK_VELOCITY_THRESHOLD && Math.abs(deltaX) >= SWIPE_FLICK_DISTANCE_THRESHOLD
  if (!meetsDistance && !isFlick) return null
  return deltaX < 0 ? -1 : 1
}
