export const STEP_STATES = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
} as const

export type StepState = (typeof STEP_STATES)[keyof typeof STEP_STATES]

export const STEP_STATE_CONFIG: Record<
  StepState,
  { label: string; colorClass: string }
> = {
  NOT_STARTED: {
    label: 'Not Started',
    colorClass: 'bg-step-not-started text-foreground',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    colorClass: 'bg-step-in-progress text-white',
  },
  COMPLETED: {
    label: 'Completed',
    colorClass: 'bg-step-completed text-white',
  },
  BLOCKED: {
    label: 'Blocked',
    colorClass: 'bg-step-blocked text-white',
  },
}
