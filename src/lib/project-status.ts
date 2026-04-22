export type DerivedProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED'

export function deriveProjectStatus(steps: { state: string }[]): DerivedProjectStatus {
  if (steps.length === 0) return 'NOT_STARTED'
  if (steps.some((s) => s.state === 'BLOCKED')) return 'BLOCKED'
  if (steps.every((s) => s.state === 'COMPLETED')) return 'COMPLETED'
  if (steps.some((s) => s.state === 'IN_PROGRESS' || s.state === 'COMPLETED')) return 'IN_PROGRESS'
  return 'NOT_STARTED'
}
