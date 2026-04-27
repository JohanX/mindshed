'use client'

import { useState, useTransition, useEffect, useRef, useCallback } from 'react'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { updateInventoryItem } from '@/actions/inventory'
import {
  getInventoryItemImages,
  addInventoryItemImageLink,
  deleteInventoryItemImage,
  type InventoryItemImageWithDisplayUrl,
} from '@/actions/inventory-image'
import { addInventoryItemImageLinkSchema } from '@/lib/schemas/inventory-image'
import { uploadInventoryImageToStorage } from '@/lib/upload-inventory-image'
import { ACCEPTED_IMAGE_TYPES } from '@/lib/constants/image-upload'
import { updateInventoryItemSchema } from '@/lib/schemas/inventory'
import type { InventoryItemData } from '@/lib/schemas/inventory'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Loader2, Upload, Trash2 } from 'lucide-react'
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
  const [selectedHobbyIds, setSelectedHobbyIds] = useState<string[]>(item.hobbies.map((h) => h.id))
  const [isPending, startTransition] = useTransition()

  const [photos, setPhotos] = useState<InventoryItemImageWithDisplayUrl[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [linkExpanded, setLinkExpanded] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [isLinking, startLinkTransition] = useTransition()
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null)
  const [isPhotoDeleting, startPhotoDeleteTransition] = useTransition()
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)

  const fetchPhotos = useCallback(async () => {
    setPhotosLoading(true)
    const result = await getInventoryItemImages(item.id)
    if (result.success) {
      setPhotos(result.data.images)
    } else {
      showErrorToast(result.error)
    }
    setPhotosLoading(false)
  }, [item.id])

  useEffect(() => {
    if (open) void fetchPhotos()
  }, [open, fetchPhotos])

  async function handlePhotoUpload(file: File) {
    if (isUploading) return
    setIsUploading(true)
    try {
      const result = await uploadInventoryImageToStorage({ inventoryItemId: item.id, file })
      if (result.success) {
        showSuccessToast('Photo added')
        await fetchPhotos()
      } else {
        showErrorToast(result.error)
      }
    } catch {
      showErrorToast('Upload failed — try again')
    } finally {
      setIsUploading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  async function handlePastedFile(file: File) {
    setLinkError(null)
    await handlePhotoUpload(file)
    setLinkExpanded(false)
    setLinkUrl('')
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) void handlePastedFile(file)
        return
      }
    }
  }

  function handleLinkSave() {
    const parsed = addInventoryItemImageLinkSchema.safeParse({
      inventoryItemId: item.id,
      url: linkUrl,
    })
    if (!parsed.success) {
      setLinkError(parsed.error.issues[0]?.message ?? 'Invalid URL')
      return
    }
    setLinkError(null)
    startLinkTransition(async () => {
      const result = await addInventoryItemImageLink({
        inventoryItemId: item.id,
        url: parsed.data.url,
      })
      if (result.success) {
        showSuccessToast('Image added')
        setLinkExpanded(false)
        setLinkUrl('')
        await fetchPhotos()
      } else {
        showErrorToast(result.error)
        setLinkError(result.error)
      }
    })
  }

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

        <div className="space-y-3 border-t pt-4" data-testid="photos-section">
          <span className="text-sm font-medium">Photos</span>

          <div className="flex flex-wrap gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handlePhotoUpload(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={isUploading}
              onClick={() => uploadInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload Photo
            </Button>

            {!linkExpanded ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={() => {
                  setLinkExpanded(true)
                  requestAnimationFrame(() => linkInputRef.current?.focus())
                }}
                data-testid="add-photo-link-prompt"
              >
                Paste Image / Link
              </Button>
            ) : (
              <div className="w-full space-y-2">
                <Input
                  ref={linkInputRef}
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleLinkSave()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setLinkExpanded(false)
                      setLinkUrl('')
                      setLinkError(null)
                    }
                  }}
                  onPaste={handlePaste}
                  placeholder={isUploading ? 'Uploading pasted image…' : 'Paste image or URL'}
                  disabled={isLinking || isUploading}
                  aria-invalid={linkError ? true : undefined}
                />
                {linkError && <p className="text-sm text-destructive">{linkError}</p>}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="min-h-[44px]"
                    onClick={handleLinkSave}
                    disabled={isLinking}
                  >
                    {isLinking ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => {
                      setLinkExpanded(false)
                      setLinkUrl('')
                      setLinkError(null)
                    }}
                    disabled={isLinking}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

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

        <ConfirmDialog
          open={deletePhotoId !== null}
          onOpenChange={(v) => {
            if (!v) setDeletePhotoId(null)
          }}
          title="Delete this photo?"
          description="This cannot be undone."
          onConfirm={handlePhotoDelete}
          loading={isPhotoDeleting}
        />
      </DialogContent>
    </Dialog>
  )
}
