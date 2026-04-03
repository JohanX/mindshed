import { Badge } from '@/components/ui/badge'
import { STEP_STATE_CONFIG, type StepState } from '@/lib/step-states'
import { cn } from '@/lib/utils'

interface StepStateBadgeProps {
  state: StepState
  size?: 'sm' | 'default'
  className?: string
}

export function StepStateBadge({ state, size = 'default', className }: StepStateBadgeProps) {
  const config = STEP_STATE_CONFIG[state]
  return (
    <Badge
      className={cn(
        config.colorClass,
        size === 'sm' && 'text-xs px-1.5 py-0',
        size === 'default' && 'text-xs px-2 py-0.5',
        className,
      )}
    >
      {config.label}
    </Badge>
  )
}
