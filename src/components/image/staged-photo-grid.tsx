'use client'

import { Trash2 } from 'lucide-react'

/**
 * A photo staged in a create dialog before its parent entity exists.
 * `previewUrl` on the file variant is a `URL.createObjectURL` blob URL
 * the parent is responsible for revoking on unstage / submit / reset.
 */
export type StagedPhoto =
  | { id: string; kind: 'file'; file: File; previewUrl: string }
  | { id: string; kind: 'url'; url: string }

interface StagedPhotoGridProps {
  photos: StagedPhoto[]
  onUnstage: (id: string) => void
  disabled?: boolean
}

/**
 * Render a grid of staged photos with a Trash2 corner-button per cell.
 * Shared by `InventoryItemFormDialog` and `IdeaFormDialog` so the cell
 * layout / aria-labels / disabled semantics never drift between the two
 * create flows.
 *
 * Returns `null` when `photos` is empty so callers can render this
 * unconditionally without an outer guard.
 */
export function StagedPhotoGrid({ photos, onUnstage, disabled = false }: StagedPhotoGridProps) {
  if (photos.length === 0) return null
  return (
    <div className="grid grid-cols-[repeat(auto-fill,80px)] gap-2" data-testid="staged-photo-grid">
      {photos.map((staged) => (
        <div key={staged.id} className="relative h-20 w-20 rounded-md">
          <div className="h-full w-full overflow-hidden rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={staged.kind === 'file' ? staged.previewUrl : staged.url}
              alt="Staged photo preview"
              className="h-full w-full object-cover"
            />
          </div>
          <button
            type="button"
            className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white"
            aria-label="Remove staged photo"
            onClick={() => onUnstage(staged.id)}
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
