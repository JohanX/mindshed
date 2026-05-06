'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { StepCard, type StepCardData } from '@/components/step/step-card'
import { DragHandle } from '@/components/dnd/drag-handle'

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

  // Story 34.3 / FR130 — responsive handle layout:
  //   < sm  (mobile): handle renders INSIDE StepCard at the leftmost
  //                   edge of the collapsed-header row (saves the 52 px
  //                   sibling rail that was eating ~14% of every row at
  //                   320–375 px viewports).
  //   ≥ sm  (desktop/tablet): handle renders here as a SIBLING of the
  //                   card (the pre-34.3 layout). Desktop has plenty of
  //                   horizontal room; the user's reported pain was
  //                   mobile-specific so the desktop layout is preserved
  //                   verbatim.
  // Both renderings share the same `useSortable` listeners — only one is
  // visible per viewport.
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-step-id={step.id}
      className="flex items-center sm:gap-2"
    >
      {!isProjectCompleted && (
        <DragHandle attributes={attributes} listeners={listeners} className="hidden sm:flex" />
      )}
      <div className="flex-1 min-w-0">
        <StepCard
          step={step}
          variant={variant}
          isProjectCompleted={isProjectCompleted}
          hobbyTracksHours={hobbyTracksHours}
          onAllStepsCompleted={onAllStepsCompleted}
          dragHandle={!isProjectCompleted ? { attributes, listeners } : undefined}
        />
      </div>
    </div>
  )
}
