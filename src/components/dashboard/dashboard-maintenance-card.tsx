'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { recordMaintenance, type MaintenanceDueItem } from '@/actions/inventory'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { Wrench, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface DashboardMaintenanceCardProps {
  item: MaintenanceDueItem
}

export function DashboardMaintenanceCard({ item }: DashboardMaintenanceCardProps) {
  const [isPending, startTransition] = useTransition()

  function handleRecord(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      const result = await recordMaintenance(item.id)
      if (result.success) showSuccessToast('Maintenance recorded')
      else showErrorToast(result.error)
    })
  }

  return (
    <Link href="/inventory" className="block">
      <Card
        className="transition-opacity hover:opacity-90"
        style={{ backgroundColor: hobbyColorWithAlpha('hsl(35, 80%, 50%)', 0.1) }}
      >
        <CardContent className="flex items-center gap-3">
          <Wrench className="h-5 w-5 shrink-0 text-step-in-progress" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className="text-xs text-step-in-progress border-step-in-progress"
              >
                Overdue by {item.daysOverdue} day{item.daysOverdue !== 1 ? 's' : ''}
              </Badge>
              <span>Last: {format(new Date(item.lastMaintenanceDate), 'MMM d')}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 min-h-[44px]"
            onClick={handleRecord}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record'}
          </Button>
        </CardContent>
      </Card>
    </Link>
  )
}
