'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarDays, Loader2, X } from 'lucide-react'
import { format } from 'date-fns'
import { createReminder, updateReminder, deleteReminder } from '@/actions/reminder'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import type { ReminderData } from '@/lib/schemas/reminder'

interface ReminderDatePickerProps {
  targetType: 'STEP' | 'PROJECT'
  targetId: string
  existingReminder?: ReminderData | null
}

export function ReminderDatePicker({ targetType, targetId, existingReminder }: ReminderDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSelect(date: Date | undefined) {
    if (!date) return

    startTransition(async () => {
      if (existingReminder) {
        const result = await updateReminder({ id: existingReminder.id, dueDate: date })
        if (result.success) {
          showSuccessToast('Reminder updated')
          setOpen(false)
        } else {
          showErrorToast(result.error)
        }
      } else {
        const result = await createReminder({ targetType, targetId, dueDate: date })
        if (result.success) {
          showSuccessToast('Reminder set')
          setOpen(false)
        } else {
          showErrorToast(result.error)
        }
      }
    })
  }

  function handleRemove() {
    if (!existingReminder) return
    startTransition(async () => {
      const result = await deleteReminder(existingReminder.id)
      if (result.success) {
        showSuccessToast('Reminder removed')
        setOpen(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-[44px] text-muted-foreground" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <CalendarDays className="h-4 w-4 mr-1" />
              {existingReminder ? format(new Date(existingReminder.dueDate), 'MMM d') : 'Remind'}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={existingReminder ? new Date(existingReminder.dueDate) : undefined}
          onSelect={handleSelect}
          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
        />
        {existingReminder && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full min-h-[44px] text-destructive" onClick={handleRemove} disabled={isPending}>
              <X className="h-4 w-4 mr-1" /> Remove Reminder
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
