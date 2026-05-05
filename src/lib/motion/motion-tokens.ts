/**
 * Story 32.2 — Motion design tokens.
 *
 * The single source of truth for JS-driven motion (Framer Motion's
 * `transition` / `variants` props) lives here. Static-shape primitives
 * driven by Radix `data-state` selectors keep using the CSS keyframes
 * declared in `src/app/globals.css` (Story 29.1's foundation). The two
 * systems coexist; their numeric values must stay in lockstep.
 *
 * **Cross-system contract** — when changing a duration here, update the
 * corresponding `--anim-duration-{fast,medium,slow}` CSS custom property
 * in `globals.css`. Otherwise a Framer-driven surface adjacent to a
 * CSS-keyframed surface visibly desyncs (different beats, same gesture).
 *
 * Numeric mapping:
 *   DURATION.quick      = 0.15s  ↔  --anim-duration-fast: 150ms
 *   DURATION.default    = 0.22s  ↔  --anim-duration-medium: 220ms
 *   DURATION.deliberate = 0.32s  ↔  --anim-duration-slow: 320ms
 *
 * `instant`, and `slow` are JS-only and do not have CSS counterparts.
 * They cover surfaces that don't have CSS-keyframe equivalents
 * (instant = reduced-motion fallback; slow = orchestrated multi-step
 * reveals like the lightbox `layoutId` morph).
 *
 * See `mindshed/src/lib/motion/README.md` for the full taxonomy and
 * usage guide.
 */

import { useReducedMotion } from 'motion/react'

/**
 * Duration tokens in **seconds** (Framer Motion's unit). Use named
 * tokens, not raw numbers, so global changes flow through everywhere.
 */
export const DURATION = {
  /** Fallback for `prefers-reduced-motion: reduce`. Also for surfaces
   *  that should not animate at all. */
  instant: 0,
  /** Hover/focus state changes, dropdown / popover / tooltip enter+exit. */
  quick: 0.15,
  /** Dialog open/close, lightbox open/close, toast in/out, status badge
   *  color shifts — the workhorse duration. */
  default: 0.22,
  /** Route transitions, larger context-switching surfaces. */
  deliberate: 0.32,
  /** Reserved for orchestrated multi-step reveals; use sparingly. */
  slow: 0.6,
} as const

/**
 * Easing presets. `standard` mirrors the `--anim-easing` cubic-bezier
 * declared in globals.css (Story 29.1's foundation curve). `easeOut` /
 * `easeInOut` are Framer Motion's named built-ins.
 */
export const EASING = {
  /** Mirrors `--anim-easing` in globals.css — symmetric ease curve. */
  standard: [0.32, 0.72, 0, 1] as [number, number, number, number],
  easeOut: 'easeOut' as const,
  easeInOut: 'easeInOut' as const,
} as const

/**
 * Spring presets. Use when the motion shape benefits from physical
 * damping (e.g., post-drop settle on a sortable card) rather than a
 * fixed-duration ease.
 */
export const SPRING = {
  gentle: { type: 'spring' as const, stiffness: 300, damping: 30 },
  snappy: { type: 'spring' as const, stiffness: 500, damping: 35 },
} as const

/**
 * Named transition primitives. Pass directly to Framer's `transition`
 * prop: `<motion.div transition={transitions.fade}>`.
 */
export const transitions = {
  /** Plain opacity transition at default duration with ease-out — the
   *  most common surface (toast, dialog overlay, status badges). */
  fade: { duration: DURATION.default, ease: EASING.easeOut },
  /** Position + opacity transition with the standard curve — dialog
   *  content slide-in, route transitions. */
  slide: { duration: DURATION.default, ease: EASING.standard },
  /** Spring-based pop for quick acknowledgements / drop-settle. */
  pop: SPRING.gentle,
  /** Symmetric crossfade at quick duration — dropdown / popover swaps. */
  crossfade: { duration: DURATION.quick, ease: EASING.easeInOut },
  /** Layout / shared-element morphs (lightbox open from thumbnail).
   *  Slightly longer to give the spatial cue time to read. */
  layout: { duration: DURATION.deliberate, ease: EASING.standard },
} as const

/**
 * Resolved durations after `prefers-reduced-motion` is applied. Wider
 * type than `DURATION` so the reduced-motion branch can set every
 * field to `0` (which the `as const` literal type on `DURATION` rejects).
 */
type ResolvedDuration = Record<keyof typeof DURATION, number>

interface ResolvedTransition {
  duration: number
  ease: (typeof EASING)[keyof typeof EASING]
}

interface ResolvedTokens {
  duration: ResolvedDuration
  easing: typeof EASING
  spring: typeof SPRING
  transitions: {
    fade: ResolvedTransition
    slide: ResolvedTransition
    pop: typeof SPRING.gentle
    crossfade: ResolvedTransition
    layout: ResolvedTransition
  }
}

/**
 * Hook that returns motion tokens with the user's
 * `prefers-reduced-motion` preference baked in. When reduced motion is
 * requested, all durations resolve to `0` so any consumer of the hook
 * gets instant animation without per-call branching.
 *
 * Use this hook in components that drive their own motion. For
 * surfaces that delegate to a higher-level provider (e.g., the global
 * `<MotionConfig reducedMotion="user">` boundary in app layout),
 * Framer already honours the preference natively; this hook is for
 * when you need the duration values directly.
 */
export function useMotionTokens(): ResolvedTokens {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return {
      duration: {
        instant: 0,
        quick: 0,
        default: 0,
        deliberate: 0,
        slow: 0,
      },
      easing: EASING,
      spring: SPRING,
      transitions: {
        fade: { duration: 0, ease: EASING.easeOut },
        slide: { duration: 0, ease: EASING.standard },
        pop: SPRING.gentle,
        crossfade: { duration: 0, ease: EASING.easeInOut },
        layout: { duration: 0, ease: EASING.standard },
      },
    }
  }

  return { duration: DURATION, easing: EASING, spring: SPRING, transitions }
}
