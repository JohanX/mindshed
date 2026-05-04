'use client'

import { useState, useTransition } from 'react'
import { type StepCardData } from '@/components/step/step-card'
import { StepCardList } from '@/components/step/step-card-list'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { completeProject } from '@/actions/project'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

interface StepCardListWithCompletionProps {
  initialSteps: StepCardData[]
  currentStepId: string | null
  isProjectCompleted: boolean
  projectId: string
  /**
   * Stable identity key for the inner StepCardList so it can remount on
   * material step-state changes without dragging the dialog state with it.
   * Owned by the server component, derived from step states/notes/images
   * (see project page `stepKey` for the canonical recipe).
   */
  stepKey: string
}

/**
 * Story 30.3 / FR127. Wraps StepCardList with the "Mark project complete?"
 * confirmation dialog. The wrapper holds the dialog state ABOVE the keyed
 * StepCardList so the dialog survives across step-state-driven remounts —
 * if dialog state lived inside StepCardList, completing the last step
 * would change `stepKey`, remount the list, and unmount the open dialog
 * before the user could see it.
 */
export function StepCardListWithCompletion({
  initialSteps,
  currentStepId,
  isProjectCompleted,
  projectId,
  stepKey,
}: StepCardListWithCompletionProps) {
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [isCompleting, startCompletingTransition] = useTransition()

  function handleAllStepsCompleted() {
    setCompletionDialogOpen(true)
  }

  function handleConfirmComplete() {
    startCompletingTransition(async () => {
      const result = await completeProject(projectId)
      if (result.success) {
        showSuccessToast('Project completed')
        setCompletionDialogOpen(false)
      } else {
        showErrorToast(result.error)
        setCompletionDialogOpen(false)
      }
    })
  }

  return (
    <>
      <StepCardList
        key={stepKey}
        initialSteps={initialSteps}
        currentStepId={currentStepId}
        isProjectCompleted={isProjectCompleted}
        projectId={projectId}
        onAllStepsCompleted={handleAllStepsCompleted}
      />
      <ConfirmDialog
        open={completionDialogOpen}
        onOpenChange={(open) => {
          if (!isCompleting) setCompletionDialogOpen(open)
        }}
        title="Mark project complete?"
        description="All steps are completed. Lock the project to prevent further edits. You can unlock it again from the project menu."
        confirmLabel="Mark complete"
        cancelLabel="Not yet"
        variant="default"
        onConfirm={handleConfirmComplete}
        loading={isCompleting}
      />
    </>
  )
}
