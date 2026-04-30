'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { STEP_STATE_CONFIG, type StepState } from '@/lib/step-states'
import { cn } from '@/lib/utils'

interface StepStateBadgeProps {
  state: StepState
  size?: 'sm' | 'default'
  className?: string
}

/**
 * Story 29.3 / FR123: when the step's `state` prop transitions, the badge
 * plays the FR123 acknowledge primitive (subtle opacity pulse via
 * `--anim-duration-fast`). Implemented via a `key` increment that forces
 * the Badge to remount — `.anim-acknowledge-on-mount` runs the
 * `anim-acknowledge` keyframe once on mount. The first render (initial
 * mount) does NOT play the animation; only state TRANSITIONS trigger it.
 */
export function StepStateBadge({ state, size = 'default', className }: StepStateBadgeProps) {
  const config = STEP_STATE_CONFIG[state]
  const previousStateRef = useRef(state)
  const [acknowledgeKey, setAcknowledgeKey] = useState(0)

  useEffect(() => {
    // Acknowledge primitive: detect prop transitions (state value changes
    // externally) and bump the key so the badge remounts and the
    // `anim-acknowledge-on-mount` keyframe replays. The cascade is
    // bounded — one extra render per actual state transition.
    if (previousStateRef.current !== state) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAcknowledgeKey((prev) => prev + 1)
      previousStateRef.current = state
    }
  }, [state])

  return (
    <Badge
      key={acknowledgeKey}
      className={cn(
        config.colorClass,
        // Skip the animation on the very first render (initial mount —
        // not a state transition). Only run it on subsequent transitions.
        acknowledgeKey > 0 && 'anim-acknowledge-on-mount',
        size === 'sm' && 'text-xs px-1.5 py-0',
        size === 'default' && 'text-xs px-2 py-0.5',
        className,
      )}
    >
      {config.label}
    </Badge>
  )
}
