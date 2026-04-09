'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { dismissReminder, snoozeReminder } from '@/actions/reminder'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { CalendarDays, MoreHorizontal } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import type { DashboardReminder } from '@/lib/schemas/reminder'

interface DashboardReminderCardProps {
  reminder: DashboardReminder
}

export function DashboardReminderCard({ reminder }: DashboardReminderCardProps) {
  const [isPending, startTransition] = useTransition()
  const dueDate = new Date(reminder.dueDate)

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissReminder(reminder.id)
      if (result.success) showSuccessToast('Reminder dismissed')
      else showErrorToast(result.error)
    })
  }

  function handleSnooze(days: 1 | 3 | 7) {
    startTransition(async () => {
      const result = await snoozeReminder({ reminderId: reminder.id, snoozeDays: days })
      if (result.success) showSuccessToast(`Snoozed for ${days} day${days > 1 ? 's' : ''}`)
      else showErrorToast(result.error)
    })
  }

  const projectUrl = `/hobbies/${reminder.hobbyId}/projects/${reminder.projectId}`

  return (
    <div className="flex items-center gap-2">
      <Link href={projectUrl} className="block flex-1 min-w-0">
        <Card
          className="transition-opacity hover:opacity-90"
          style={{ backgroundColor: reminder.isOverdue ? hobbyColorWithAlpha('hsl(35, 80%, 50%)', 0.1) : hobbyColorWithAlpha(reminder.hobby.color, 0.08) }}
        >
          <CardContent className="flex items-center gap-3">
            <CalendarDays className={`h-5 w-5 shrink-0 ${reminder.isOverdue ? 'text-step-in-progress' : 'text-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{reminder.targetName}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HobbyIdentity hobby={reminder.hobby} variant="dot" />
                <span className="truncate">
                  {reminder.isOverdue
                    ? `Overdue: ${formatDistanceToNow(dueDate)} ago`
                    : `Due ${format(dueDate, 'MMM d')}`
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] shrink-0" disabled={isPending}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Reminder actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-[44px]" onClick={handleDismiss}>Dismiss</DropdownMenuItem>
          <DropdownMenuItem className="min-h-[44px]" onClick={() => handleSnooze(1)}>Snooze 1 day</DropdownMenuItem>
          <DropdownMenuItem className="min-h-[44px]" onClick={() => handleSnooze(3)}>Snooze 3 days</DropdownMenuItem>
          <DropdownMenuItem className="min-h-[44px]" onClick={() => handleSnooze(7)}>Snooze 1 week</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
