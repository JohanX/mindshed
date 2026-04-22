'use client'

import { useState, useRef, useTransition } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { type StepCardData } from '@/components/step/step-card'
import { SortableStepCard } from '@/components/step/sortable-step-card'
import { reorderSteps } from '@/actions/step'
import { showErrorToast } from '@/lib/toast'

interface StepCardListProps {
  initialSteps: StepCardData[]
  currentStepId: string | null
  isProjectCompleted: boolean
  projectId: string
}

export function StepCardList({
  initialSteps,
  currentStepId,
  isProjectCompleted,
  projectId,
}: StepCardListProps) {
  const [steps, setSteps] = useState(initialSteps)
  const lastConfirmedOrderRef = useRef(initialSteps)
  const [, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = steps.findIndex((step) => step.id === active.id)
    const newIndex = steps.findIndex((step) => step.id === over.id)
    const newSteps = arrayMove(steps, oldIndex, newIndex)
    setSteps(newSteps)
    persistOrder(newSteps)
  }

  function persistOrder(newSteps: StepCardData[]) {
    startTransition(async () => {
      const result = await reorderSteps({
        projectId,
        orderedStepIds: newSteps.map((step) => step.id),
      })
      if (result.success) {
        lastConfirmedOrderRef.current = newSteps
      } else {
        showErrorToast(result.error)
        setSteps(lastConfirmedOrderRef.current)
      }
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={steps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {steps.map((step) => (
            <SortableStepCard
              key={step.id}
              step={step}
              variant={step.id === currentStepId ? 'current' : 'other'}
              isProjectCompleted={isProjectCompleted}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
