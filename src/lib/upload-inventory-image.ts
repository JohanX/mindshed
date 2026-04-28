/**
 * Backward-compatible thin wrapper for inventory item image upload.
 * Story 25.4 collapsed the per-entity uploaders into a single `uploadImage`
 * mechanism (see `src/lib/upload-image.ts`). New code should call
 * `uploadImage({ kind: 'inventory', parentId, file })` directly.
 */
import { uploadImage, type UploadResult } from '@/lib/upload-image'

export function uploadInventoryImageToStorage(params: {
  inventoryItemId: string
  file: File
}): Promise<UploadResult> {
  return uploadImage({ kind: 'inventory', parentId: params.inventoryItemId, file: params.file })
}
