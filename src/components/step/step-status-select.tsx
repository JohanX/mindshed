'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StepStateBadge } from '@/components/step-state-badge'
import { STEP_STATES, type StepState } from '@/lib/step-states'

interface StepStatusSelectProps {
  currentState: StepState
  previousState: StepState | null
  onStateChange: (newState: StepState) => void
  disabled?: boolean
}

const STATE_ORDER: StepState[] = [
  STEP_STATES.NOT_STARTED,
  STEP_STATES.IN_PROGRESS,
  STEP_STATES.COMPLETED,
  STEP_STATES.BLOCKED,
]

export function StepStatusSelect({
  currentState,
  previousState,
  onStateChange,
  disabled,
}: StepStatusSelectProps) {
  return (
    <Select
      value={currentState}
      onValueChange={(value) => onStateChange(value as StepState)}
      disabled={disabled}
    >
      <SelectTrigger
        className="min-h-[44px] w-auto shrink-0 border-0 bg-transparent p-1 shadow-none ring-0 focus-visible:ring-0 focus-visible:border-0"
        aria-label="Step status"
      >
        <SelectValue>
          <StepStateBadge state={currentState} size="sm" />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATE_ORDER.map((state) => (
          <SelectItem
            key={state}
            value={state}
            className="min-h-[44px] rounded-none focus:bg-muted/50 focus:text-foreground"
          >
            <StepStateBadge state={state} size="sm" />
            {state !== 'BLOCKED' && currentState === 'BLOCKED' && previousState && state === previousState && (
              <span className="text-xs text-muted-foreground ml-1">(restore)</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
