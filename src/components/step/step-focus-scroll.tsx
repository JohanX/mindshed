'use client'

import { useEffect, useRef } from 'react'

interface StepFocusScrollProps {
  focusedStepId: string | null
}

/**
 * FR116: smoothly scrolls the project's focused step into view on mount and
 * whenever the focused step id changes.
 *
 * This component is rendered OUTSIDE the keyed `StepCardList` so it is not
 * remounted on every server-action revalidate (which changes `stepKey` for
 * every note/image/blocker mutation). A `lastScrolledTo` ref ensures we
 * only scroll once per unique focused id — re-renders that pass the same id
 * are no-ops. A new id (e.g. user completed the IN_PROGRESS step → focus
 * shifts to the next step, or navigation arrives with a different ?step=)
 * triggers a fresh scroll.
 */
export function StepFocusScroll({ focusedStepId }: StepFocusScrollProps) {
  const lastScrolledTo = useRef<string | null>(null)

  useEffect(() => {
    if (!focusedStepId) return
    if (lastScrolledTo.current === focusedStepId) return
    lastScrolledTo.current = focusedStepId
    const target = document.querySelector<HTMLElement>(
      `[data-step-id="${CSS.escape(focusedStepId)}"]`,
    )
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusedStepId])

  return null
}
