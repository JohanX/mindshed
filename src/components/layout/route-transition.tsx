'use client'

import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { useMotionTokens } from '@/lib/motion/motion-tokens'

interface RouteTransitionProps {
  children: React.ReactNode
}

/**
 * Story 32.5 — fades + slides the `(app)` route content on navigation.
 *
 * Keyed by `usePathname()` so React reconciles a key change as
 * `unmount old → mount new`, after which the new `motion.div` runs its
 * `initial → animate` cycle. Uses the `default` motion token (220ms)
 * with the standard easing so timing aligns with dialog open/close and
 * toast in/out elsewhere.
 *
 * Honours `prefers-reduced-motion: reduce` automatically — the
 * `<MotionConfig reducedMotion="user">` boundary at the app root
 * collapses transitions to instant for users who opt out.
 *
 * Caveat: Next.js App Router's segment caching can prevent the keyed
 * wrapper from re-mounting cleanly on certain navigations (e.g.,
 * shallow updates within the same segment). The transition is best-
 * effort; if a navigation skips it, the page content still appears
 * — the worst case is "no animation," not "broken nav."
 *
 * Issue #17: there is intentionally NO `AnimatePresence` here. The
 * earlier `AnimatePresence mode="wait"` setup could leave a
 * freshly-mounted keyed child latched onto the exiting child's
 * in-flight motion values under App Router's RSC streaming — the new
 * page would mount at `opacity: 0; translateY(-8px)` (the exit state)
 * and never advance to `animate`, leaving the route blank until a
 * viewport resize forced a repaint. Dropping `mode="wait"` removed the
 * stuck-state but left two full route subtrees in the DOM during the
 * 220ms exit overlap (layout doubled, effects double-fired, `id`
 * attributes could collide). Removing `AnimatePresence` altogether
 * eliminates both failure modes: there is no exit cycle to leak
 * values, and React unmounts the old subtree before mounting the new
 * one — no overlap, no orphaned effects. The only thing lost is the
 * exit animation; the entering page still slides + fades in.
 */
export function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname()
  const tokens = useMotionTokens()

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tokens.transitions.slide}
      data-testid="route-transition"
    >
      {children}
    </motion.div>
  )
}
