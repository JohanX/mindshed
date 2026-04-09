'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { createInventoryItem } from '@/actions/inventory'
import { createInventoryItemSchema } from '@/lib/schemas/inventory'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, Loader2 } from 'lucide-react'

export function CreateInventoryItemDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('MATERIAL')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() {
    setName('')
    setType('MATERIAL')
    setQuantity('')
    setUnit('')
    setNotes('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const input = {
      name,
      type: type as 'MATERIAL' | 'CONSUMABLE' | 'TOOL',
      quantity: quantity ? parseFloat(quantity) : undefined,
      unit: unit || undefined,
      notes: notes || undefined,
    }

    const parsed = createInventoryItemSchema.safeParse(input)
    if (!parsed.success) {
      showErrorToast(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    startTransition(async () => {
      const result = await createInventoryItem(parsed.data)
      if (result.success) {
        showSuccessToast('Item added')
        reset()
        setOpen(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="min-h-[44px]">
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Inventory Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Walnut lumber"
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="item-type" className="min-h-[44px]">
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
              <div className="flex items-baseline gap-2">
                <Label htmlFor="item-quantity">Quantity</Label>
                <span className="text-xs text-muted-foreground">optional</span>
              </div>
              <Input
                id="item-quantity"
                type="number"
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <Label htmlFor="item-unit">Unit</Label>
                <span className="text-xs text-muted-foreground">optional</span>
              </div>
              <Input
                id="item-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g., meters"
                maxLength={50}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <Label htmlFor="item-notes">Notes</Label>
              <span className="text-xs text-muted-foreground">optional</span>
            </div>
            <Textarea
              id="item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              maxLength={500}
              rows={2}
            />
          </div>

          <Button type="submit" disabled={!name.trim() || isPending} className="w-full min-h-[44px]">
            {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : 'Add Item'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
