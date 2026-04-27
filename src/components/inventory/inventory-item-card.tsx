'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EditInventoryItemDialog } from '@/components/inventory/edit-inventory-item-dialog'
import { MaintenanceSection } from '@/components/inventory/maintenance-section'
import { ImageLightbox } from '@/components/image/image-lightbox'
import { deleteInventoryItem } from '@/actions/inventory'
import { getInventoryItemImages } from '@/actions/inventory-image'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import type { InventoryItemData } from '@/lib/schemas/inventory'
import type { GalleryImage } from '@/components/image/image-gallery'
import { getContrastTextColor } from '@/lib/hobby-color'

const TYPE_CONFIG = {
  MATERIAL: { label: 'Material', colorClass: 'bg-step-in-progress text-white' },
  CONSUMABLE: { label: 'Consumable', colorClass: 'bg-step-completed text-white' },
  TOOL: { label: 'Tool', colorClass: 'bg-step-blocked text-white' },
} as const

interface InventoryItemCardProps {
  item: InventoryItemData
  hobbies: { id: string; name: string; color: string }[]
}

export function InventoryItemCard({ item, hobbies }: InventoryItemCardProps) {
  const typeConfig = TYPE_CONFIG[item.type]
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startTransition] = useTransition()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<GalleryImage[]>([])
  const [lightboxLoading, setLightboxLoading] = useState(false)

  async function openLightbox() {
    setLightboxOpen(true)
    setLightboxLoading(true)
    const result = await getInventoryItemImages(item.id)
    if (result.success) {
      if (result.data.images.length === 0) {
        setLightboxOpen(false)
        setLightboxLoading(false)
        return
      }
      setLightboxImages(
        result.data.images.map((img) => ({
          id: img.id,
          displayUrl: img.displayUrl,
          thumbnailUrl: img.thumbnailUrl,
          originalFilename: img.originalFilename,
        })),
      )
    } else {
      setLightboxOpen(false)
    }
    setLightboxLoading(false)
  }

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
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {item.heroThumbnailUrl && (
                <button
                  type="button"
                  className="h-12 w-12 shrink-0 overflow-hidden rounded-md min-h-[44px] min-w-[44px]"
                  onClick={() => void openLightbox()}
                  aria-label={`View photos of ${item.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.heroThumbnailUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </button>
              )}
              <span className="font-medium truncate min-w-0">{item.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => setEditOpen(true)}
                title="Edit item"
                aria-label={`Edit ${item.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] text-destructive"
                onClick={() => setDeleteOpen(true)}
                title="Delete item"
                aria-label={`Delete ${item.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={typeConfig.colorClass} variant="default">
              {typeConfig.label}
            </Badge>
            {(item.quantity !== null || item.unit) && (
              <span className="text-sm text-muted-foreground">
                {item.quantity !== null && item.quantity}
                {item.quantity !== null && item.unit && ' '}
                {item.unit}
              </span>
            )}
          </div>
          {item.hobbies.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.hobbies.map((hobby) => (
                <span
                  key={hobby.id}
                  className="text-xs rounded-full px-2 py-0.5"
                  style={{ backgroundColor: hobby.color, color: getContrastTextColor(hobby.color) }}
                >
                  {hobby.name}
                </span>
              ))}
            </div>
          )}
          {item.notes && <p className="text-sm text-muted-foreground line-clamp-2">{item.notes}</p>}
          {item.activeBlockerCount > 0 && (
            <Badge variant="outline" className="text-xs text-step-blocked border-step-blocked">
              {item.activeBlockerCount} blocker{item.activeBlockerCount > 1 ? 's' : ''}
            </Badge>
          )}
          <MaintenanceSection item={item} />
        </CardContent>
      </Card>

      <EditInventoryItemDialog item={item} hobbies={hobbies} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => {
          if (!isDeleting) setDeleteOpen(v)
        }}
        title="Delete this item?"
        description="Any linked blockers will have their inventory link cleared."
        onConfirm={handleDelete}
        loading={isDeleting}
      />

      {lightboxOpen && lightboxLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
      {lightboxOpen && !lightboxLoading && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
          showDelete={false}
        />
      )}
    </>
  )
}
