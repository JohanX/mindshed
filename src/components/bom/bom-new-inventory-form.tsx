'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { addBomItemWithNewInventory } from '@/actions/bom'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import type { InventoryOption, InventoryType } from '@/lib/bom'

interface BomNewInventoryFormProps {
  projectId: string
  initialName: string
  onSaved: (result: {
    id: string
    inventoryItemId: string
    finalName: string
    created: InventoryOption
    requiredQuantity: number
    unit: string | null
  }) => void
  onCancel: () => void
}

const TYPES: { value: InventoryType; label: string; emoji: string }[] = [
  { value: 'MATERIAL', label: 'Material', emoji: '🧱' },
  { value: 'CONSUMABLE', label: 'Consumable', emoji: '🧴' },
  { value: 'TOOL', label: 'Tool', emoji: '🔧' },
]

export function BomNewInventoryForm({
  projectId,
  initialName,
  onSaved,
  onCancel,
}: BomNewInventoryFormProps) {
  const [name, setName] = useState(initialName)
  const [type, setType] = useState<InventoryType>('MATERIAL')
  const [startingQuantity, setStartingQuantity] = useState('0')
  const [unit, setUnit] = useState('')
  const [requiredQuantity, setRequiredQuantity] = useState('')
  const [isPending, startTransition] = useTransition()

  const startingNum = Number(startingQuantity)
  const requiredNum = Number(requiredQuantity)
  const canSubmit =
    name.trim().length > 0 &&
    Number.isFinite(startingNum) &&
    startingNum >= 0 &&
    Number.isFinite(requiredNum) &&
    requiredNum > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    startTransition(async () => {
      const result = await addBomItemWithNewInventory({
        projectId,
        newItem: {
          name: name.trim(),
          type,
          startingQuantity: startingNum,
          unit: unit.trim() || undefined,
        },
        requiredQuantity: requiredNum,
      })
      if (!result.success) {
        showErrorToast(result.error)
        return
      }
      const resolvedUnit = unit.trim() || null
      showSuccessToast(`Added '${result.data.finalName}' to inventory and BOM`)
      onSaved({
        id: result.data.id,
        inventoryItemId: result.data.inventoryItemId,
        finalName: result.data.finalName,
        created: {
          id: result.data.inventoryItemId,
          name: result.data.finalName,
          type,
          quantity: startingNum,
          unit: resolvedUnit,
        },
        requiredQuantity: requiredNum,
        unit: resolvedUnit,
      })
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-border bg-background p-3"
    >
      <div className="space-y-1">
        <Label htmlFor="bom-new-inv-name">Inventory item name</Label>
        <Input
          id="bom-new-inv-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
        />
      </div>

      <div className="space-y-1">
        <Label>Type</Label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((typeOption) => (
            <label
              key={typeOption.value}
              className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border px-3 py-1 text-sm ${
                type === typeOption.value
                  ? 'border-ring bg-accent text-accent-foreground'
                  : 'border-input'
              }`}
            >
              <input
                type="radio"
                name="bom-new-inv-type"
                value={typeOption.value}
                checked={type === typeOption.value}
                onChange={() => setType(typeOption.value)}
                className="sr-only"
              />
              <span aria-hidden>{typeOption.emoji}</span>
              {typeOption.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="bom-new-inv-starting">Starting qty</Label>
          <Input
            id="bom-new-inv-starting"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={startingQuantity}
            onChange={(e) => setStartingQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bom-new-inv-unit">Unit (optional)</Label>
          <Input
            id="bom-new-inv-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            maxLength={50}
            placeholder="g"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bom-new-inv-required">Required for this project</Label>
          <Input
            id="bom-new-inv-required"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={requiredQuantity}
            onChange={(e) => setRequiredQuantity(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="min-h-[44px]" disabled={!canSubmit || isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            'Save & add'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
