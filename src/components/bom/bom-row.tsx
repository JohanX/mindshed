'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { updateBomItem, deleteBomItem } from '@/actions/bom'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import { renderAvailable, type BomItemData } from '@/lib/bom'

interface BomRowProps {
  row: BomItemData
  variant: 'desktop' | 'mobile'
  onUpdate: (
    id: string,
    patch: { requiredQuantity?: number; unit?: string | null; label?: string },
  ) => void
  onDelete: (id: string) => void
}

function AvailableCell({ row }: { row: BomItemData }) {
  const { label, variant } = renderAvailable(row)
  const className =
    variant === 'ok'
      ? 'text-step-completed'
      : variant === 'short'
        ? 'text-step-blocked font-medium'
        : variant === 'consumed'
          ? 'inline-flex items-center rounded-full bg-step-completed px-2 py-0.5 text-xs text-white'
          : variant === 'undone'
            ? 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
            : 'text-muted-foreground'
  return <span className={className}>{label}</span>
}

export function BomRow({ row, variant, onUpdate, onDelete }: BomRowProps) {
  const [required, setRequired] = useState<string>(String(row.requiredQuantity))
  const [unit, setUnit] = useState<string>(row.unit ?? '')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()

  const isEditingLocked = row.consumptionState !== 'NOT_CONSUMED'
  const displayName = row.inventoryItem?.name ?? row.label ?? '(unnamed)'
  const nameIsMuted = !!row.inventoryItem?.isDeleted
  const nameClass = nameIsMuted
    ? 'italic text-muted-foreground'
    : 'text-foreground'

  async function persistRequired() {
    const num = Number(required)
    if (!Number.isFinite(num) || num <= 0) {
      setRequired(String(row.requiredQuantity))
      return
    }
    if (num === row.requiredQuantity) return
    const result = await updateBomItem({ id: row.id, requiredQuantity: num })
    if (!result.success) {
      showErrorToast(result.error)
      setRequired(String(row.requiredQuantity))
      return
    }
    onUpdate(row.id, { requiredQuantity: num })
    showSuccessToast('BOM item updated')
  }

  async function persistUnit() {
    const next = unit.trim()
    const current = row.unit ?? ''
    if (next === current) return
    const result = await updateBomItem({
      id: row.id,
      unit: next === '' ? null : next,
    })
    if (!result.success) {
      showErrorToast(result.error)
      setUnit(current)
      return
    }
    onUpdate(row.id, { unit: next === '' ? null : next })
    showSuccessToast('BOM item updated')
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteBomItem(row.id)
      if (!result.success) {
        showErrorToast(result.error)
        setDeleteOpen(false)
        return
      }
      onDelete(row.id)
      showSuccessToast('BOM item deleted')
      setDeleteOpen(false)
    })
  }

  const actions = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            aria-label="BOM row actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="min-h-[44px] text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete row
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => { if (!isDeleting) setDeleteOpen(v) }}
        title="Delete BOM row?"
        description={`"${displayName}" will be removed from this project's Bill of Materials. The inventory item itself is unaffected.`}
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </>
  )

  if (variant === 'desktop') {
    return (
      <tr className="border-b last:border-b-0">
        <td className="py-2 pr-3">
          <span className={nameClass} title={nameIsMuted ? 'Item removed from inventory' : undefined}>
            {displayName}
          </span>
        </td>
        <td className="py-2 pr-3">
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={required}
            onChange={(e) => setRequired(e.target.value)}
            onBlur={persistRequired}
            disabled={isEditingLocked}
            aria-label="Required quantity"
            className="h-9"
          />
        </td>
        <td className="py-2 pr-3">
          <Input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            onBlur={persistUnit}
            disabled={isEditingLocked}
            maxLength={50}
            aria-label="Unit"
            className="h-9"
          />
        </td>
        <td className="py-2 pr-3">
          <AvailableCell row={row} />
        </td>
        <td className="py-2 pr-0 text-right">{actions}</td>
      </tr>
    )
  }

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`font-medium ${nameClass}`} title={nameIsMuted ? 'Item removed from inventory' : undefined}>
          {displayName}
        </span>
        {actions}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Required</span>
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={required}
            onChange={(e) => setRequired(e.target.value)}
            onBlur={persistRequired}
            disabled={isEditingLocked}
            aria-label="Required quantity"
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Unit</span>
          <Input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            onBlur={persistUnit}
            disabled={isEditingLocked}
            maxLength={50}
            aria-label="Unit"
          />
        </div>
      </div>
      <div className="mt-2 text-sm">
        <span className="text-xs text-muted-foreground">Available: </span>
        <AvailableCell row={row} />
      </div>
    </div>
  )
}
