'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setStepHours } from '@/actions/step'
import { showErrorToast } from '@/lib/toast'
import { formatHours } from '@/lib/hours-format'

interface StepHoursCounterProps {
  stepId: string
  initialHours: number | null
  /** True when project.isCompleted — disables the +/- and clear buttons. */
  disabled?: boolean
}

const INCREMENT = 0.5
const SAVE_DEBOUNCE_MS = 500

/**
 * Story 30.5 / FR129 — per-step hours counter. Mounted only when the parent
 * hobby has `hoursTrackingEnabled === true` (gated higher in the tree). The
 * +/- buttons step by 0.5; "−" disabled at 0/null; "+" has no upper cap;
 * the small × clears the value back to null.
 *
 * Saves are debounced: a single `setStepHours` call fires `SAVE_DEBOUNCE_MS`
 * after the last +/- click. Buttons stay responsive throughout — no
 * per-click disable, no per-click round-trip. On save failure we revert to
 * the last server-confirmed value and surface a toast.
 */
export function StepHoursCounter({
  stepId,
  initialHours,
  disabled = false,
}: StepHoursCounterProps) {
  const [value, setValue] = useState<number | null>(initialHours)
  // Last value the server confirmed; revert target when a save fails.
  const lastSavedRef = useRef<number | null>(initialHours)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup on unmount — clear any pending debounce timer. The unsaved
  // change (if any) is dropped, which is acceptable: a 500ms navigation
  // window for an isolated counter tweak is a thin edge case.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  function scheduleSave(target: number | null) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      saveTimeoutRef.current = null
      const result = await setStepHours({ id: stepId, hours: target })
      if (result.success) {
        lastSavedRef.current = target
      } else {
        showErrorToast(result.error)
        setValue(lastSavedRef.current)
      }
    }, SAVE_DEBOUNCE_MS)
  }

  function handleDecrement() {
    if (value === null || value === 0) return
    const next = Math.max(0, value - INCREMENT)
    setValue(next)
    scheduleSave(next)
  }

  function handleIncrement() {
    const next = (value ?? 0) + INCREMENT
    setValue(next)
    scheduleSave(next)
  }

  function handleClear() {
    setValue(null)
    scheduleSave(null)
  }

  const displayLabel = formatHours(value) ?? '—'
  const decrementDisabled = disabled || value === null || value === 0
  const incrementDisabled = disabled
  const clearDisabled = disabled || value === null

  return (
    <div className="flex items-center gap-2" aria-label="Hours logged for this step">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="min-h-[44px] min-w-[44px]"
        onClick={handleDecrement}
        disabled={decrementDisabled}
        aria-label="Decrease hours by 0.5"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <div
        className="min-w-[3.5rem] text-center text-sm tabular-nums"
        aria-live="polite"
        data-testid="step-hours-value"
      >
        {displayLabel}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="min-h-[44px] min-w-[44px]"
        onClick={handleIncrement}
        disabled={incrementDisabled}
        aria-label="Increase hours by 0.5"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-[44px] min-w-[44px] text-muted-foreground"
        onClick={handleClear}
        disabled={clearDisabled}
        aria-label="Clear logged hours"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
