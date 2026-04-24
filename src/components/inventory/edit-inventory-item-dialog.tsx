'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateInventoryItem } from '@/actions/inventory'
import { updateInventoryItemSchema } from '@/lib/schemas/inventory'
import type { InventoryItemData } from '@/lib/schemas/inventory'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Loader2 } from 'lucide-react'
import { HobbyToggleChips } from './hobby-toggle-chips'

interface EditInventoryItemDialogProps {
  item: InventoryItemData
  hobbies: { id: string; name: string; color: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditInventoryItemDialog({
  item,
  hobbies,
  open,
  onOpenChange,
}: EditInventoryItemDialogProps) {
  const [name, setName] = useState(item.name)
  const [type, setType] = useState<string>(item.type)
  const [quantity, setQuantity] = useState(item.quantity?.toString() ?? '')
  const [unit, setUnit] = useState(item.unit ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [selectedHobbyIds, setSelectedHobbyIds] = useState<string[]>(
    item.hobbies.map((h) => h.id),
  )
  const [isPending, startTransition] = useTransition()

  function toggleHobby(id: string) {
    setSelectedHobbyIds((prev) =>
      prev.includes(id) ? prev.filter((hId) => hId !== id) : [...prev, id],
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const input = {
      id: item.id,
      name,
      type: type as 'MATERIAL' | 'CONSUMABLE' | 'TOOL',
      quantity: quantity ? parseFloat(quantity) : undefined,
      unit: unit || undefined,
      notes: notes || undefined,
      hobbyIds: selectedHobbyIds,
    }

    const parsed = updateInventoryItemSchema.safeParse(input)
    if (!parsed.success) {
      showErrorToast(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    startTransition(async () => {
      const result = await updateInventoryItem(parsed.data)
      if (result.success) {
        showSuccessToast('Item updated')
        onOpenChange(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="edit-item-name">Name</Label>
            <Input
              id="edit-item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-item-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="edit-item-type" className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MATERIAL">Material</SelectItem>
                <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                <SelectItem value="TOOL">Tool</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-item-qty">Quantity</Label>
              <Input
                id="edit-item-qty"
                type="number"
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-item-unit">Unit</Label>
              <Input
                id="edit-item-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                maxLength={50}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-item-notes">Notes</Label>
            <Textarea
              id="edit-item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
          <HobbyToggleChips
            hobbies={hobbies}
            selectedIds={selectedHobbyIds}
            onToggle={toggleHobby}
          />
          <Button
            type="submit"
            disabled={!name.trim() || isPending}
            className="w-full min-h-[44px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
