'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { updateMaintenanceData, recordMaintenance } from '@/actions/inventory'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { getNextMaintenanceDate, isMaintenanceOverdue, getDaysOverdue } from '@/lib/maintenance'
import { format } from 'date-fns'
import { Wrench, Loader2 } from 'lucide-react'

interface MaintenanceSectionProps {
  item: {
    id: string
    type: 'MATERIAL' | 'CONSUMABLE' | 'TOOL'
    lastMaintenanceDate: Date | null
    maintenanceIntervalDays: number | null
  }
}

export function MaintenanceSection({ item }: MaintenanceSectionProps) {
  const [isPending, startTransition] = useTransition()
  const [intervalInput, setIntervalInput] = useState(item.maintenanceIntervalDays?.toString() ?? '')

  if (item.type !== 'TOOL') return null

  const hasData = item.lastMaintenanceDate && item.maintenanceIntervalDays

  function handleRecord() {
    startTransition(async () => {
      const result = await recordMaintenance(item.id)
      if (result.success) showSuccessToast('Maintenance recorded')
      else showErrorToast(result.error)
    })
  }

  function handleSetup() {
    const days = parseInt(intervalInput, 10)
    if (!days || days < 1) {
      showErrorToast('Enter a valid interval (1-365 days)')
      return
    }
    startTransition(async () => {
      const result = await updateMaintenanceData({
        id: item.id,
        lastMaintenanceDate: new Date(),
        maintenanceIntervalDays: days,
      })
      if (result.success) {
        showSuccessToast('Maintenance schedule set')
      } else {
        showErrorToast(result.error)
      }
    })
  }

  if (!hasData) {
    return (
      <div className="pt-2 space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Wrench className="h-3 w-3" /> Set up maintenance schedule
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor={`interval-${item.id}`} className="text-xs shrink-0">Every</Label>
          <Input
            id={`interval-${item.id}`}
            type="number"
            min={1}
            max={365}
            value={intervalInput}
            onChange={(e) => setIntervalInput(e.target.value)}
            placeholder="30"
            className="w-20 min-h-[44px]"
          />
          <span className="text-xs text-muted-foreground">days</span>
          <Button size="sm" className="min-h-[44px]" onClick={handleSetup} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set'}
          </Button>
        </div>
      </div>
    )
  }

  const nextDate = getNextMaintenanceDate(new Date(item.lastMaintenanceDate!), item.maintenanceIntervalDays!)
  const overdue = isMaintenanceOverdue(new Date(item.lastMaintenanceDate!), item.maintenanceIntervalDays!)
  const daysOver = getDaysOverdue(new Date(item.lastMaintenanceDate!), item.maintenanceIntervalDays!)

  return (
    <div className="pt-2 space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wrench className="h-3 w-3" />
        <span>Every {item.maintenanceIntervalDays} days</span>
        <span>·</span>
        <span>Last: {format(new Date(item.lastMaintenanceDate!), 'MMM d')}</span>
      </div>
      <div className="flex items-center gap-2">
        {overdue ? (
          <Badge variant="outline" className="text-xs text-step-in-progress border-step-in-progress">
            Overdue by {daysOver} day{daysOver !== 1 ? 's' : ''}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Next: {format(nextDate, 'MMM d')}</span>
        )}
        <Button variant="ghost" size="sm" className="min-h-[44px] text-xs" onClick={handleRecord} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record Maintenance'}
        </Button>
      </div>
    </div>
  )
}
