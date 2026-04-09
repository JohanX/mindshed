import { Badge } from '@/components/ui/badge'
import { CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import type { ReminderData } from '@/lib/schemas/reminder'

interface ReminderBadgeProps {
  reminder: ReminderData
}

export function ReminderBadge({ reminder }: ReminderBadgeProps) {
  const isOverdue = new Date(reminder.dueDate) < new Date() && !reminder.isDismissed

  return (
    <Badge
      variant="outline"
      className={isOverdue
        ? 'text-step-in-progress border-step-in-progress text-xs'
        : 'text-muted-foreground border-muted text-xs'
      }
    >
      <CalendarDays className="h-3 w-3 mr-1" />
      {isOverdue ? 'Overdue: ' : ''}{format(new Date(reminder.dueDate), 'MMM d')}
    </Badge>
  )
}
