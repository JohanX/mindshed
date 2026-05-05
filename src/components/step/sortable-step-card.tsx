'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { StepCard, type StepCardData } from '@/components/step/step-card'
import { GripVertical } from 'lucide-react'

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
    <div ref={setNodeRef} style={style} className="flex items-center gap-2" data-step-id={step.id}>
      {!isProjectCompleted && (
        <button
          // Story 32.1: handle is visible at every viewport. `touch-none`
          // hands the drag gesture to dnd-kit's TouchSensor without iOS
          // Safari fighting it with bouncy scroll; `select-none` kills
          // long-press text selection on the handle.
          className="flex items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none select-none"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <StepCard
          step={step}
          variant={variant}
          isProjectCompleted={isProjectCompleted}
          hobbyTracksHours={hobbyTracksHours}
          onAllStepsCompleted={onAllStepsCompleted}
        />
      </div>
    </div>
  )
}
