'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog'
import { deleteInventoryItem } from '@/actions/inventory'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Pencil, Trash2 } from 'lucide-react'
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
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteInventoryItem(item.id)
      if (result.success) {
        showSuccessToast('Item deleted')
        setDeleteOpen(false)
      } else {
        showErrorToast(result.error)
        setDeleteOpen(false)
      }
    })
  }

  return (
    <>
      <Card className="min-h-[44px]">
        <CardContent className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">{item.name}</span>
            <div className="flex items-center gap-1 shrink-0">
              <Badge className={typeConfig.colorClass} variant="default">
                {typeConfig.label}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} title="Edit item" aria-label="Edit item">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteOpen(true)} title="Delete item" aria-label="Delete item">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
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
          {item.activeBlockerCount > 0 && (
            <Badge variant="outline" className="text-xs text-step-blocked border-step-blocked">
              {item.activeBlockerCount} blocker{item.activeBlockerCount > 1 ? 's' : ''}
            </Badge>
          )}
        </CardContent>
      </Card>

      <EditInventoryItemDialog item={item} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => { if (!isDeleting) setDeleteOpen(v) }}
        title="Delete this item?"
        description="Any linked blockers will have their inventory link cleared."
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </>
  )
}
