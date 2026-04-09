'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { StepCard, type StepCardData } from '@/components/step/step-card'
import { GripVertical } from 'lucide-react'

interface SortableStepCardProps {
  step: StepCardData
  variant: 'current' | 'other'
  isProjectCompleted: boolean
}

export function SortableStepCard({ step, variant, isProjectCompleted }: SortableStepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      {!isProjectCompleted && (
        <button
          className="flex items-center justify-center min-h-[44px] min-w-[44px] mt-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
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
        />
      </div>
    </div>
  )
}
