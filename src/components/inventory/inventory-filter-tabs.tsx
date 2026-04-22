'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InventoryItemCard } from '@/components/inventory/inventory-item-card'
import { cn } from '@/lib/utils'
import type { InventoryItemData } from '@/lib/schemas/inventory'

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'MATERIAL', label: 'Materials' },
  { key: 'CONSUMABLE', label: 'Consumables' },
  { key: 'TOOL', label: 'Tools' },
] as const

interface InventoryFilterTabsProps {
  items: InventoryItemData[]
}

export function InventoryFilterTabs({ items }: InventoryFilterTabsProps) {
  const [filter, setFilter] = useState<string>('ALL')

  const filtered = filter === 'ALL' ? items : items.filter((i) => i.type === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <Button
            key={key}
            variant={filter === key ? 'default' : 'outline'}
            size="sm"
            className={cn('min-h-[44px]', filter === key && 'pointer-events-none')}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <InventoryItemCard key={item.id} item={item} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-4">No items in this category.</p>
      )}
    </div>
  )
}
