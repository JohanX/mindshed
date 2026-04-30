import { describe, it, expect } from 'vitest'
import {
  determineSwipeAxis,
  evaluateSwipeCommit,
  SWIPE_AXIS_LOCK_DISTANCE,
  SWIPE_COMMIT_DISTANCE_THRESHOLD,
  SWIPE_FLICK_VELOCITY_THRESHOLD,
  SWIPE_FLICK_DISTANCE_THRESHOLD,
} from '../swipe-helpers'

describe('determineSwipeAxis', () => {
  it('returns null when neither axis has moved past the lock distance', () => {
    expect(determineSwipeAxis(0, 0)).toBeNull()
    expect(determineSwipeAxis(SWIPE_AXIS_LOCK_DISTANCE - 1, 0)).toBeNull()
    expect(determineSwipeAxis(0, SWIPE_AXIS_LOCK_DISTANCE - 1)).toBeNull()
    expect(
      determineSwipeAxis(SWIPE_AXIS_LOCK_DISTANCE - 1, SWIPE_AXIS_LOCK_DISTANCE - 1),
    ).toBeNull()
  })

  it('locks horizontal when |deltaX| > |deltaY| and at least one axis past lock', () => {
    expect(determineSwipeAxis(SWIPE_AXIS_LOCK_DISTANCE, 0)).toBe('horizontal')
    expect(determineSwipeAxis(50, 10)).toBe('horizontal')
    expect(determineSwipeAxis(-50, 10)).toBe('horizontal') // negative dx still horizontal
  })

  it('locks vertical when |deltaY| >= |deltaX| and at least one axis past lock', () => {
    expect(determineSwipeAxis(0, SWIPE_AXIS_LOCK_DISTANCE)).toBe('vertical')
    expect(determineSwipeAxis(10, 50)).toBe('vertical')
  })

  it('treats perfectly diagonal motion as vertical so the browser handles it', () => {
    expect(determineSwipeAxis(20, 20)).toBe('vertical')
    expect(determineSwipeAxis(-20, 20)).toBe('vertical')
  })

  it('flagging negative direction without crossing lock distance still returns null', () => {
    expect(determineSwipeAxis(-(SWIPE_AXIS_LOCK_DISTANCE - 1), 0)).toBeNull()
  })
})

describe('evaluateSwipeCommit', () => {
  it('returns null on zero-distance gesture', () => {
    expect(evaluateSwipeCommit(0, 100)).toBeNull()
  })

  it('commits leftward (next) when distance threshold is met', () => {
    expect(evaluateSwipeCommit(-SWIPE_COMMIT_DISTANCE_THRESHOLD, 200)).toBe(-1)
    expect(evaluateSwipeCommit(-(SWIPE_COMMIT_DISTANCE_THRESHOLD + 50), 200)).toBe(-1)
  })

  it('commits rightward (prev) when distance threshold is met', () => {
    expect(evaluateSwipeCommit(SWIPE_COMMIT_DISTANCE_THRESHOLD, 200)).toBe(1)
  })

  it('returns null when distance is below threshold and not a flick', () => {
    // 30px traveled over 500ms → velocity 0.06 px/ms (well below flick).
    expect(evaluateSwipeCommit(30, 500)).toBeNull()
    expect(evaluateSwipeCommit(-30, 500)).toBeNull()
  })

  it('commits as a flick when velocity is high and distance crosses the flick floor', () => {
    // Distance 30px over 50ms → velocity 0.6 px/ms (above 0.3 flick).
    // Distance 30px is above 20px flick floor but below 50px commit floor.
    // Should still commit as a flick.
    expect(evaluateSwipeCommit(-30, 50)).toBe(-1)
    expect(evaluateSwipeCommit(30, 50)).toBe(1)
  })

  it('does NOT commit when velocity is high but distance is below flick floor', () => {
    // 15px / 30ms → velocity 0.5 px/ms (above flick velocity) BUT
    // 15px < 20px flick distance floor → still no commit.
    expect(evaluateSwipeCommit(-15, 30)).toBeNull()
    expect(evaluateSwipeCommit(SWIPE_FLICK_DISTANCE_THRESHOLD - 1, 30)).toBeNull()
  })

  it('does NOT commit when distance crosses flick floor but velocity is below threshold', () => {
    // 25px / 1000ms → velocity 0.025 px/ms (well below flick velocity).
    // Distance 25px < 50px commit floor → no commit.
    expect(evaluateSwipeCommit(25, 1000)).toBeNull()
  })

  it('handles zero/near-zero elapsed without divide-by-zero', () => {
    // Synthetic events can yield elapsedMs ≤ 0; the helper guards via
    // `Math.max(1, elapsedMs)`. With deltaX above the flick floor and
    // 0ms elapsed, velocity is effectively distance/1 → flick.
    expect(evaluateSwipeCommit(-30, 0)).toBe(-1)
    expect(evaluateSwipeCommit(-30, -50)).toBe(-1) // negative elapsed clamped
  })

  it('flick velocity threshold is exactly inclusive', () => {
    // velocity = SWIPE_FLICK_VELOCITY_THRESHOLD exactly + dist meets flick floor → commit
    const dx = SWIPE_FLICK_DISTANCE_THRESHOLD
    const elapsed = dx / SWIPE_FLICK_VELOCITY_THRESHOLD
    expect(evaluateSwipeCommit(dx, elapsed)).toBe(1)
  })

  it('distance threshold is exactly inclusive', () => {
    expect(evaluateSwipeCommit(SWIPE_COMMIT_DISTANCE_THRESHOLD, 1000)).toBe(1)
    expect(evaluateSwipeCommit(SWIPE_COMMIT_DISTANCE_THRESHOLD - 1, 1000)).toBeNull()
  })
})
