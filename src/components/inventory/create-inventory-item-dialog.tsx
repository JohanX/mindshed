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
import { uploadImage } from '@/lib/upload-image'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, Loader2 } from 'lucide-react'
import { HobbyToggleChips } from './hobby-toggle-chips'
import { StagedPhotoInput } from '@/components/image/staged-photo-input'

interface CreateInventoryItemDialogProps {
  hobbies: { id: string; name: string; color: string }[]
}

export function CreateInventoryItemDialog({ hobbies }: CreateInventoryItemDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('MATERIAL')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedHobbyIds, setSelectedHobbyIds] = useState<string[]>([])
  const [stagedPhoto, setStagedPhoto] = useState<File | null>(null)
  // FR120 idempotency: cache the just-created item id so retries after
  // a photo-upload failure don't duplicate the item.
  const [createdItemId, setCreatedItemId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isInRetryState = createdItemId !== null

  function reset() {
    setName('')
    setType('MATERIAL')
    setQuantity('')
    setUnit('')
    setNotes('')
    setSelectedHobbyIds([])
    setStagedPhoto(null)
    setCreatedItemId(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) reset()
  }

  function toggleHobby(id: string) {
    setSelectedHobbyIds((prev) =>
      prev.includes(id) ? prev.filter((hId) => hId !== id) : [...prev, id],
    )
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    startTransition(async () => {
      let itemId = createdItemId

      // Step 1: create item if not yet created in this dialog session.
      if (itemId === null) {
        const input = {
          name,
          type: type as 'MATERIAL' | 'CONSUMABLE' | 'TOOL',
          quantity: quantity ? parseFloat(quantity) : undefined,
          unit: unit || undefined,
          notes: notes || undefined,
          hobbyIds: selectedHobbyIds.length > 0 ? selectedHobbyIds : undefined,
        }
        const parsed = createInventoryItemSchema.safeParse(input)
        if (!parsed.success) {
          showErrorToast(parsed.error.issues[0]?.message ?? 'Invalid input')
          return
        }
        const result = await createInventoryItem(parsed.data)
        if (!result.success) {
          showErrorToast(result.error)
          return
        }
        itemId = result.data.id
        setCreatedItemId(itemId)
      }

      // Step 2: upload staged photo if any.
      if (stagedPhoto) {
        const upload = await uploadImage({
          kind: 'inventory',
          parentId: itemId,
          file: stagedPhoto,
        })
        if (!upload.success) {
          // FR120 graceful-degradation: dialog stays open in retry state.
          showErrorToast(`Photo upload failed: ${upload.error}`)
          return
        }
      }

      showSuccessToast(stagedPhoto ? 'Item added with photo' : 'Item added')
      reset()
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              disabled={isInRetryState}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-type">Type</Label>
            <Select value={type} onValueChange={setType} disabled={isInRetryState}>
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
                disabled={isInRetryState}
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
                disabled={isInRetryState}
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
              disabled={isInRetryState}
            />
          </div>

          <HobbyToggleChips
            hobbies={hobbies}
            selectedIds={selectedHobbyIds}
            onToggle={isInRetryState ? () => {} : toggleHobby}
          />

          <StagedPhotoInput
            stagedFile={stagedPhoto}
            onStage={setStagedPhoto}
            onClear={() => setStagedPhoto(null)}
            disabled={isPending}
          />

          <Button
            type="submit"
            disabled={(!isInRetryState && !name.trim()) || isPending}
            className="w-full min-h-[44px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isInRetryState ? 'Retrying photo…' : 'Adding…'}
              </>
            ) : isInRetryState ? (
              stagedPhoto ? (
                'Retry photo upload'
              ) : (
                'Done'
              )
            ) : (
              'Add Item'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
