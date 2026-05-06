'use client'

import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { useMotionTokens } from '@/lib/motion/motion-tokens'

interface RouteTransitionProps {
  children: React.ReactNode
}

/**
 * Story 32.5 — fades + slides the `(app)` route content on navigation.
 *
 * Keyed by `usePathname()` so AnimatePresence sees a different child key
 * on each route change and runs the exit/enter cycle. Uses the
 * `default` motion token (220ms) with the standard easing so timing
 * aligns with dialog open/close and toast in/out elsewhere.
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
 */
export function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname()
  const tokens = useMotionTokens()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={tokens.transitions.slide}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
