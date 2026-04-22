import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DerivedProjectStatus } from '@/lib/project-status'

const STATUS_CONFIG: Record<DerivedProjectStatus, { label: string; colorClass: string }> = {
  NOT_STARTED: { label: 'Not Started', colorClass: 'bg-step-not-started text-foreground' },
  IN_PROGRESS: { label: 'In Progress', colorClass: 'bg-step-in-progress text-white' },
  BLOCKED: { label: 'Blocked', colorClass: 'bg-step-blocked text-white' },
  COMPLETED: { label: 'Completed', colorClass: 'bg-step-completed text-white' },
}

interface ProjectStatusBadgeProps {
  status: DerivedProjectStatus
  size?: 'sm' | 'default'
  className?: string
}

export function ProjectStatusBadge({
  status,
  size = 'default',
  className,
}: ProjectStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
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
