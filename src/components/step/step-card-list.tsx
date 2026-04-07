'use client'

import { useState, useTransition } from 'react'
import { StepCard, type StepCardData } from '@/components/step/step-card'
import { reorderSteps } from '@/actions/step'
import { showErrorToast } from '@/lib/toast'
import { arrayMove } from '@dnd-kit/sortable'

interface StepCardListProps {
  initialSteps: StepCardData[]
  currentStepId: string | null
  isProjectCompleted: boolean
  projectId: string
}

export function StepCardList({ initialSteps, currentStepId, isProjectCompleted, projectId }: StepCardListProps) {
  const [steps, setSteps] = useState(initialSteps)
  const [, startTransition] = useTransition()

  function handleMoveUp(stepId: string) {
    const idx = steps.findIndex(s => s.id === stepId)
    if (idx <= 0) return
    const newSteps = arrayMove(steps, idx, idx - 1)
    setSteps(newSteps)
    persistOrder(newSteps)
  }

  function handleMoveDown(stepId: string) {
    const idx = steps.findIndex(s => s.id === stepId)
    if (idx >= steps.length - 1) return
    const newSteps = arrayMove(steps, idx, idx + 1)
    setSteps(newSteps)
    persistOrder(newSteps)
  }

  function persistOrder(newSteps: StepCardData[]) {
    startTransition(async () => {
      const result = await reorderSteps({
        projectId,
        orderedStepIds: newSteps.map(s => s.id),
      })
      if (!result.success) {
        showErrorToast(result.error)
        setSteps(initialSteps)
      }
    })
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <StepCard
          key={step.id}
          step={step}
          variant={step.id === currentStepId ? 'current' : 'other'}
          isProjectCompleted={isProjectCompleted}
          index={index}
          total={steps.length}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
      ))}
    </div>
  )
}
