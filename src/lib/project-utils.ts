import type { StepState } from '@/lib/step-states'

export interface StepForCurrentStep {
  name: string
  state: string
  sortOrder: number
}

/**
 * Finds the current step: first IN_PROGRESS step, or first NOT_STARTED step by sortOrder.
 * Steps must be pre-sorted by sortOrder ascending.
 */
export function getCurrentStep(
  steps: StepForCurrentStep[],
): { name: string; state: StepState } | null {
  const inProgress = steps.find((s) => s.state === 'IN_PROGRESS')
  if (inProgress) return { name: inProgress.name, state: inProgress.state as StepState }

  const notStarted = steps.find((s) => s.state === 'NOT_STARTED')
  if (notStarted) return { name: notStarted.name, state: notStarted.state as StepState }

  return null
}
