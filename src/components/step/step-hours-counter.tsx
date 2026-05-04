'use client'

import { useState, useTransition } from 'react'
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

/**
 * Story 30.5 / FR129 — per-step hours counter. Mounted only when the parent
 * hobby has `hoursTrackingEnabled === true` (gated higher in the tree). The
 * +/- buttons step by 0.5; "−" disabled at 0 / null; "+" has no upper cap;
 * the small × clears the value back to null. Optimistic local state with
 * server-action persistence; on error we revert and toast.
 */
export function StepHoursCounter({
  stepId,
  initialHours,
  disabled = false,
}: StepHoursCounterProps) {
  const [value, setValue] = useState<number | null>(initialHours)
  const [isPending, startTransition] = useTransition()

  function persist(nextValue: number | null) {
    const previous = value
    setValue(nextValue)
    startTransition(async () => {
      const result = await setStepHours({ id: stepId, hours: nextValue })
      if (!result.success) {
        showErrorToast(result.error)
        setValue(previous)
      }
    })
  }

  function handleDecrement() {
    if (value === null || value === 0) return
    const next = Math.max(0, value - INCREMENT)
    persist(next)
  }

  function handleIncrement() {
    const next = (value ?? 0) + INCREMENT
    persist(next)
  }

  function handleClear() {
    persist(null)
  }

  const displayLabel = formatHours(value) ?? '—'
  const decrementDisabled = disabled || isPending || value === null || value === 0
  const incrementDisabled = disabled || isPending
  const clearDisabled = disabled || isPending || value === null

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
