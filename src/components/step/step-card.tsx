'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StepStateBadge } from '@/components/step-state-badge'
import { updateStepState } from '@/actions/step'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { StepState } from '@/lib/step-states'

interface StepCardProps {
  step: {
    id: string
    name: string
    state: StepState
    sortOrder: number
  }
  variant: 'current' | 'other'
  isProjectCompleted: boolean
  projectId: string
  hobbyId: string
}

export function StepCard({
  step,
  variant,
  isProjectCompleted,
}: StepCardProps) {
  const [expanded, setExpanded] = useState(variant === 'current')
  const [isPending, startTransition] = useTransition()

  function handleStateChange(newState: StepState) {
    startTransition(async () => {
      const result = await updateStepState({ id: step.id, state: newState })
      if (result.success) {
        showSuccessToast(
          'Step ' + (newState === 'COMPLETED' ? 'completed' : 'started'),
        )
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <Card data-testid={`step-card-${step.id}`}>
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-3 text-left',
          'min-h-[44px] cursor-pointer',
        )}
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="font-medium truncate">{step.name}</span>
        <StepStateBadge state={step.state} size="sm" />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="space-y-4 pt-0">
            {/* Placeholder areas for future features */}
            <div className="text-sm text-muted-foreground">
              <p>Photos, notes, and blockers will appear here.</p>
            </div>

            {/* Action buttons */}
            {!isProjectCompleted && (
              <div className="flex flex-wrap gap-2">
                {step.state === 'NOT_STARTED' && (
                  <Button
                    size="sm"
                    className="min-h-[44px]"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStateChange('IN_PROGRESS')
                    }}
                    disabled={isPending}
                  >
                    Start
                  </Button>
                )}
                {step.state === 'IN_PROGRESS' && (
                  <Button
                    size="sm"
                    className="min-h-[44px]"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStateChange('COMPLETED')
                    }}
                    disabled={isPending}
                  >
                    Mark Complete
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  disabled
                >
                  Add Note
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  disabled
                >
                  Upload Photo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  disabled
                >
                  Add Blocker
                </Button>
              </div>
            )}
          </CardContent>
        </div>
      </div>
    </Card>
  )
}
