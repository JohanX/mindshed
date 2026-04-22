export type DerivedProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED'

export function deriveProjectStatus(steps: { state: string }[]): DerivedProjectStatus {
  if (steps.length === 0) return 'NOT_STARTED'
  if (steps.some((step) => step.state === 'BLOCKED')) return 'BLOCKED'
  if (steps.every((step) => step.state === 'COMPLETED')) return 'COMPLETED'
  if (steps.some((step) => step.state === 'IN_PROGRESS' || step.state === 'COMPLETED'))
    return 'IN_PROGRESS'
  return 'NOT_STARTED'
}
