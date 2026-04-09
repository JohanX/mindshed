import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InventoryItemData } from '@/lib/schemas/inventory'

const TYPE_CONFIG = {
  MATERIAL: { label: 'Material', colorClass: 'bg-step-in-progress text-white' },
  CONSUMABLE: { label: 'Consumable', colorClass: 'bg-step-completed text-white' },
  TOOL: { label: 'Tool', colorClass: 'bg-step-blocked text-white' },
} as const

interface InventoryItemCardProps {
  item: InventoryItemData
}

export function InventoryItemCard({ item }: InventoryItemCardProps) {
  const typeConfig = TYPE_CONFIG[item.type]

  return (
    <Card className="min-h-[44px]">
      <CardContent className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">{item.name}</span>
          <Badge className={typeConfig.colorClass} variant="default">
            {typeConfig.label}
          </Badge>
        </div>
        {(item.quantity !== null || item.unit) && (
          <p className="text-sm text-muted-foreground">
            {item.quantity !== null && item.quantity}
            {item.quantity !== null && item.unit && ' '}
            {item.unit}
          </p>
        )}
        {item.notes && (
          <p className="text-sm text-muted-foreground line-clamp-2">{item.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}
