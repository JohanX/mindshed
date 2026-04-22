'use client'

import { useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setResultStep } from '@/actions/gallery'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

interface ResultStepSelectorProps {
  projectId: string
  steps: { id: string; name: string }[]
  resultStepId: string | null
}

export function ResultStepSelector({ projectId, steps, resultStepId }: ResultStepSelectorProps) {
  const [isPending, startTransition] = useTransition()

  const defaultStepId = resultStepId ?? steps[steps.length - 1]?.id

  function handleChange(stepId: string) {
    startTransition(async () => {
      const result = await setResultStep(projectId, stepId)
      if (result.success) {
        showSuccessToast('Result step updated')
      } else {
        showErrorToast(result.error)
      }
    })
  }

  if (steps.length === 0) return null

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">Result step:</label>
      <Select value={defaultStepId} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="min-h-[44px]" aria-label="Result step">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {steps.map((step) => (
            <SelectItem key={step.id} value={step.id} className="min-h-[44px]">
              {step.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
