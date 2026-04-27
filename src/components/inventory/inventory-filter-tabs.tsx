'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InventoryItemCard } from '@/components/inventory/inventory-item-card'
import { getContrastTextColor } from '@/lib/hobby-color'
import type { InventoryItemData } from '@/lib/schemas/inventory'

const TYPE_FILTERS = [
  { key: 'MATERIAL', label: 'Materials' },
  { key: 'CONSUMABLE', label: 'Consumables' },
  { key: 'TOOL', label: 'Tools' },
] as const

type TypeFilter = (typeof TYPE_FILTERS)[number]['key']

interface InventoryFilterTabsProps {
  items: InventoryItemData[]
  hobbies: { id: string; name: string; color: string }[]
}

export function InventoryFilterTabs({ items, hobbies }: InventoryFilterTabsProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter | null>(null)
  const [hobbyFilter, setHobbyFilter] = useState<string | null>(null)

  const filtered = items.filter((item) => {
    if (typeFilter && item.type !== typeFilter) return false
    if (hobbyFilter === 'UNTAGGED') return item.hobbies.length === 0
    if (hobbyFilter) {
      return (
        item.hobbies.some((h) => h.id === hobbyFilter) || item.hobbies.length === 0
      )
    }
    return true
  })

  const hobbyTabs = hobbies.length > 0 && (
    <div className="flex gap-1 flex-wrap">
      {hobbies.map((hobby) => (
        <Button
          key={hobby.id}
          variant="outline"
          size="sm"
          aria-pressed={hobbyFilter === hobby.id}
          className="min-h-[44px]"
          style={
            hobbyFilter === hobby.id
              ? { backgroundColor: hobby.color, color: getContrastTextColor(hobby.color), borderColor: hobby.color }
              : { borderColor: hobby.color, color: hobby.color }
          }
          onClick={() => setHobbyFilter(hobbyFilter === hobby.id ? null : hobby.id)}
        >
          {hobby.name}
        </Button>
      ))}
      <Button
        variant={hobbyFilter === 'UNTAGGED' ? 'default' : 'outline'}
        size="sm"
        aria-pressed={hobbyFilter === 'UNTAGGED'}
        className="min-h-[44px]"
        onClick={() => setHobbyFilter(hobbyFilter === 'UNTAGGED' ? null : 'UNTAGGED')}
      >
        Untagged
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex gap-1 flex-wrap">
          {TYPE_FILTERS.map(({ key, label }) => (
            <Button
              key={key}
              variant={typeFilter === key ? 'default' : 'outline'}
              size="sm"
              aria-pressed={typeFilter === key}
              className="min-h-[44px]"
              onClick={() => setTypeFilter(typeFilter === key ? null : key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="hidden sm:block">{hobbyTabs}</div>
      </div>
      <div className="sm:hidden">{hobbyTabs}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <InventoryItemCard key={item.id} item={item} hobbies={hobbies} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-4">No items in this category.</p>
      )}
    </div>
  )
}
