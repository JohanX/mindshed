import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Hoist-mock motion/react so each test can flip useReducedMotion's
// return value before importing motion-tokens.
vi.mock('motion/react', () => ({
  useReducedMotion: vi.fn(),
}))

import { useReducedMotion } from 'motion/react'
import { useMotionTokens, DURATION, EASING } from '../motion-tokens'

const mockUseReducedMotion = vi.mocked(useReducedMotion)

describe('useMotionTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when prefers-reduced-motion is NOT set', () => {
    beforeEach(() => {
      mockUseReducedMotion.mockReturnValue(false)
    })

    it('returns DURATION values verbatim', () => {
      const { result } = renderHook(() => useMotionTokens())
      expect(result.current.duration).toEqual(DURATION)
    })

    it('returns easing presets verbatim', () => {
      const { result } = renderHook(() => useMotionTokens())
      expect(result.current.easing).toEqual(EASING)
    })

    it('transitions.fade uses the default duration (220 ms = 0.22s)', () => {
      const { result } = renderHook(() => useMotionTokens())
      expect(result.current.transitions.fade.duration).toBe(0.22)
    })

    it('transitions.layout uses the deliberate duration (320 ms = 0.32s)', () => {
      const { result } = renderHook(() => useMotionTokens())
      expect(result.current.transitions.layout.duration).toBe(0.32)
    })
  })

  describe('when prefers-reduced-motion IS set', () => {
    beforeEach(() => {
      mockUseReducedMotion.mockReturnValue(true)
    })

    it('all DURATION values resolve to 0', () => {
      const { result } = renderHook(() => useMotionTokens())
      expect(result.current.duration.instant).toBe(0)
      expect(result.current.duration.quick).toBe(0)
      expect(result.current.duration.default).toBe(0)
      expect(result.current.duration.deliberate).toBe(0)
      expect(result.current.duration.slow).toBe(0)
    })

    it('all named transitions resolve to duration 0', () => {
      const { result } = renderHook(() => useMotionTokens())
      // Springs (e.g. transitions.pop) don't carry a `duration` field —
      // they're physics-driven. The reduced-motion path leaves the
      // spring config untouched; Framer's `<MotionConfig reducedMotion>`
      // boundary is what neutralises spring motion at the lib level.
      expect(result.current.transitions.fade.duration).toBe(0)
      expect(result.current.transitions.slide.duration).toBe(0)
      expect(result.current.transitions.crossfade.duration).toBe(0)
      expect(result.current.transitions.layout.duration).toBe(0)
    })

    it('preserves easing values (only durations are zeroed)', () => {
      const { result } = renderHook(() => useMotionTokens())
      expect(result.current.transitions.fade.ease).toBe(EASING.easeOut)
      expect(result.current.transitions.slide.ease).toBe(EASING.standard)
    })
  })
})

describe('motion token constants', () => {
  it('DURATION.quick aligns with --anim-duration-fast (150 ms)', () => {
    expect(DURATION.quick).toBe(0.15)
  })

  it('DURATION.default aligns with --anim-duration-medium (220 ms)', () => {
    expect(DURATION.default).toBe(0.22)
  })

  it('DURATION.deliberate aligns with --anim-duration-slow (320 ms)', () => {
    expect(DURATION.deliberate).toBe(0.32)
  })

  it('EASING.standard mirrors the project cubic-bezier', () => {
    // Same numbers as `--anim-easing` in src/app/globals.css.
    expect(EASING.standard).toEqual([0.32, 0.72, 0, 1])
  })
})
