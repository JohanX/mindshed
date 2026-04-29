'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { createInventoryItem, updateInventoryItem } from '@/actions/inventory'
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  type InventoryItemData,
} from '@/lib/schemas/inventory'
import {
  getInventoryItemImages,
  addInventoryItemImageLink,
  deleteInventoryItemImage,
  type InventoryItemImageWithDisplayUrl,
} from '@/actions/inventory-image'
import { uploadImage } from '@/lib/upload-image'
import { IMAGE_LIMITS } from '@/lib/constants/image-limits'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { HobbyToggleChips } from './hobby-toggle-chips'
import { ImageFormInputs } from '@/components/image/image-form-inputs'

/**
 * Story 27.1 (FR121): unified inventory-item form covering both CREATE
 * and EDIT modes. Mirrors the `hobby-form.tsx` / `HobbyFormDialog`
 * pattern — one component, optional `item?` prop, internal state if
 * uncontrolled, controlled `open`/`onOpenChange` if provided.
 *
 * Photo input is delegated to the shared `<ImageFormInputs>` component:
 * - Create mode → `mode='staged'`, value held in this component's state,
 *   committed after the inventory item is created (FR120 idempotent
 *   atomic-create-with-retry).
 * - Edit mode → `mode='live'`, fires actions immediately against the
 *   existing item. The photo grid (with delete) lives here and reloads
 *   via `getInventoryItemImages` when the dialog opens or after any
 *   image change.
 */

interface InventoryItemFormDialogProps {
  item?: InventoryItemData
  hobbies: { id: string; name: string; color: string }[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function InventoryItemFormDialog({
  item,
  hobbies,
  open: controlledOpen,
  onOpenChange,
}: InventoryItemFormDialogProps) {
  const isEditMode = !!item
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen

  // Common form fields (prefilled from item in edit mode).
  const [name, setName] = useState(item?.name ?? '')
  const [type, setType] = useState<string>(item?.type ?? 'MATERIAL')
  const [quantity, setQuantity] = useState(item?.quantity?.toString() ?? '')
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [selectedHobbyIds, setSelectedHobbyIds] = useState<string[]>(
    item?.hobbies.map((hobby) => hobby.id) ?? [],
  )
  const [isPending, startTransition] = useTransition()

  // Create-mode only: staged photo state + idempotency cache.
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [stagedUrl, setStagedUrl] = useState<string | null>(null)
  const [createdItemId, setCreatedItemId] = useState<string | null>(null)

  // Edit-mode only: photo grid state.
  const [photos, setPhotos] = useState<InventoryItemImageWithDisplayUrl[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null)
  const [isPhotoDeleting, startPhotoDeleteTransition] = useTransition()

  const isInRetryState = createdItemId !== null
  const hasStagedPhoto = stagedFile !== null || stagedUrl !== null

  function resetCreateState() {
    setName('')
    setType('MATERIAL')
    setQuantity('')
    setUnit('')
    setNotes('')
    setSelectedHobbyIds([])
    setStagedFile(null)
    setStagedUrl(null)
    setCreatedItemId(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && item) {
      // Re-prefill from item on every open so external changes propagate.
      setName(item.name)
      setType(item.type)
      setQuantity(item.quantity?.toString() ?? '')
      setUnit(item.unit ?? '')
      setNotes(item.notes ?? '')
      setSelectedHobbyIds(item.hobbies.map((hobby) => hobby.id))
    }
    if (onOpenChange) {
      onOpenChange(nextOpen)
    } else {
      setInternalOpen(nextOpen)
    }
    if (!nextOpen && !isEditMode) {
      resetCreateState()
    }
  }

  // ----- Edit-mode photo grid loading -----
  const fetchPhotos = useCallback(async () => {
    if (!item) return
    setPhotosLoading(true)
    const result = await getInventoryItemImages(item.id)
    if (result.success) {
      setPhotos(result.data.images)
    } else {
      showErrorToast(result.error)
    }
    setPhotosLoading(false)
  }, [item])

  useEffect(() => {
    // Load existing photos when the dialog opens in edit mode. Same
    // load-on-open pattern as `idea-edit-dialog.tsx` — the cascading
    // render only fires once per open transition and is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void fetchPhotos()
  }, [open, fetchPhotos])

  function handlePhotoDelete() {
    if (!deletePhotoId) return
    startPhotoDeleteTransition(async () => {
      const result = await deleteInventoryItemImage(deletePhotoId)
      if (result.success) {
        showSuccessToast('Photo deleted')
        setDeletePhotoId(null)
        await fetchPhotos()
      } else {
        showErrorToast(result.error)
        setDeletePhotoId(null)
      }
    })
  }

  // ----- Hobby toggle helper -----
  function toggleHobby(hobbyId: string) {
    setSelectedHobbyIds((prev) =>
      prev.includes(hobbyId)
        ? prev.filter((selectedId) => selectedId !== hobbyId)
        : [...prev, hobbyId],
    )
  }

  // ----- Stage handlers (mutually exclusive: stage one, clear the other) -----
  function handleStageFile(file: File) {
    setStagedFile(file)
    setStagedUrl(null)
  }
  function handleStageUrl(url: string) {
    setStagedUrl(url)
    setStagedFile(null)
  }
  function handleClearStaged() {
    setStagedFile(null)
    setStagedUrl(null)
  }

  // ----- Submit -----
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (isEditMode && item) {
      handleEditSubmit(item.id)
    } else {
      handleCreateSubmit()
    }
  }

  function handleEditSubmit(itemId: string) {
    const input = {
      id: itemId,
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
        handleOpenChange(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  function handleCreateSubmit() {
    startTransition(async () => {
      let itemId = createdItemId

      // Step 1: create the inventory item if not yet created in this session.
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

      // Step 2: attach the staged photo (File or URL) if any.
      if (stagedFile) {
        const upload = await uploadImage({
          kind: 'inventory',
          parentId: itemId,
          file: stagedFile,
        })
        if (!upload.success) {
          showErrorToast(`Photo upload failed: ${upload.error}`)
          return
        }
      } else if (stagedUrl) {
        const linkResult = await addInventoryItemImageLink({
          inventoryItemId: itemId,
          url: stagedUrl,
        })
        if (!linkResult.success) {
          showErrorToast(`Photo link failed: ${linkResult.error}`)
          return
        }
      }

      showSuccessToast(stagedFile || stagedUrl ? 'Item added with photo' : 'Item added')
      resetCreateState()
      handleOpenChange(false)
    })
  }

  // ----- Submit button label -----
  function getSubmitLabel(): string {
    if (isPending) {
      if (isEditMode) return 'Saving…'
      if (isInRetryState) return 'Retrying photo…'
      return 'Adding…'
    }
    if (isEditMode) return 'Save'
    if (isInRetryState) return hasStagedPhoto ? 'Retry photo upload' : 'Done'
    return 'Add Item'
  }

  // ----- Submit button enabled state -----
  const submitDisabled = (() => {
    if (isPending) return true
    if (isEditMode) return !name.trim()
    if (isInRetryState) return false // retry / done is always actionable
    return !name.trim()
  })()

  // ----- Field disabled state -----
  const fieldsDisabled = !isEditMode && isInRetryState

  const dialogBody = (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEditMode ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="space-y-2">
          <Label htmlFor="inventory-item-name">Name</Label>
          <Input
            id="inventory-item-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g., Walnut lumber"
            maxLength={100}
            autoFocus={!isEditMode}
            disabled={fieldsDisabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inventory-item-type">Type</Label>
          <Select value={type} onValueChange={setType} disabled={fieldsDisabled}>
            <SelectTrigger id="inventory-item-type" className="min-h-[44px]">
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
              <Label htmlFor="inventory-item-quantity">Quantity</Label>
              {!isEditMode && <span className="text-xs text-muted-foreground">optional</span>}
            </div>
            <Input
              id="inventory-item-quantity"
              type="number"
              min={0}
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="0"
              disabled={fieldsDisabled}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <Label htmlFor="inventory-item-unit">Unit</Label>
              {!isEditMode && <span className="text-xs text-muted-foreground">optional</span>}
            </div>
            <Input
              id="inventory-item-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="e.g., meters"
              maxLength={50}
              disabled={fieldsDisabled}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <Label htmlFor="inventory-item-notes">Notes</Label>
            {!isEditMode && <span className="text-xs text-muted-foreground">optional</span>}
          </div>
          <Textarea
            id="inventory-item-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Any additional details..."
            maxLength={500}
            rows={2}
            disabled={fieldsDisabled}
          />
        </div>

        <HobbyToggleChips
          hobbies={hobbies}
          selectedIds={selectedHobbyIds}
          onToggle={fieldsDisabled ? () => {} : toggleHobby}
        />

        {/* Photo input: staged in create mode, live in edit mode */}
        {!isEditMode ? (
          <div className="space-y-2">
            <span className="text-sm font-medium">Photo</span>
            <span className="ml-2 text-xs text-muted-foreground">optional</span>
            <ImageFormInputs
              mode="staged"
              entityKind="inventory"
              stagedFile={stagedFile}
              stagedUrl={stagedUrl}
              onStageFile={handleStageFile}
              onStageUrl={handleStageUrl}
              onClear={handleClearStaged}
              disabled={isPending}
            />
          </div>
        ) : null}

        <Button type="submit" disabled={submitDisabled} className="w-full min-h-[44px]">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {getSubmitLabel()}
            </>
          ) : (
            getSubmitLabel()
          )}
        </Button>
      </form>

      {/* Edit-mode photo grid: existing photos + add controls */}
      {isEditMode && item && (
        <div className="space-y-3 border-t pt-4" data-testid="photos-section">
          <span className="text-sm font-medium">Photos</span>

          {photos.length >= IMAGE_LIMITS.inventory ? (
            <p className="text-xs text-muted-foreground">
              Image limit reached ({IMAGE_LIMITS.inventory}). Delete a photo to add another.
            </p>
          ) : (
            <ImageFormInputs
              mode="live"
              entityKind="inventory"
              entityId={item.id}
              onChange={fetchPhotos}
            />
          )}

          {photosLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading photos...
            </div>
          )}

          {!photosLoading && photos.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,80px)] gap-2" data-testid="photo-grid">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative h-20 w-20 rounded-md">
                  <div className="h-full w-full overflow-hidden rounded-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.originalFilename ?? 'Inventory item photo'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Delete photo"
                    onClick={() => setDeletePhotoId(photo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!photosLoading && photos.length === 0 && (
            <p className="text-sm text-muted-foreground">No photos yet</p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deletePhotoId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeletePhotoId(null)
        }}
        title="Delete this photo?"
        description="This cannot be undone."
        onConfirm={handlePhotoDelete}
        loading={isPhotoDeleting}
      />
    </DialogContent>
  )

  if (isEditMode) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {dialogBody}
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="min-h-[44px]">
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      </DialogTrigger>
      {dialogBody}
    </Dialog>
  )
}
