'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { StepCard, type StepCardData } from '@/components/step/step-card'

interface SortableStepCardProps {
  step: StepCardData
  variant: 'current' | 'other'
  isProjectCompleted: boolean
  hobbyTracksHours: boolean
  onAllStepsCompleted?: () => void
}

export function SortableStepCard({
  step,
  variant,
  isProjectCompleted,
  hobbyTracksHours,
  onAllStepsCompleted,
}: SortableStepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} data-step-id={step.id}>
      <StepCard
        step={step}
        variant={variant}
        isProjectCompleted={isProjectCompleted}
        hobbyTracksHours={hobbyTracksHours}
        onAllStepsCompleted={onAllStepsCompleted}
        // Story 34.3 / FR130 — handle is rendered INSIDE StepCard's
        // collapsed header at the leftmost edge. Sibling-of-card column
        // is gone. `useSortable`'s attributes + listeners thread through
        // the `dragHandle` prop. `!isProjectCompleted` keeps the same
        // gate semantic — a completed project has no handle at all.
        dragHandle={!isProjectCompleted ? { attributes, listeners } : undefined}
      />
    </div>
  )
}
