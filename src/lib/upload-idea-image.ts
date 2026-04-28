/**
 * Backward-compatible thin wrapper for idea image upload.
 * Story 25.4 collapsed the per-entity uploaders into a single `uploadImage`
 * mechanism (see `src/lib/upload-image.ts`). New code should call
 * `uploadImage({ kind: 'idea', parentId, file })` directly.
 */
import { uploadImage, type UploadResult } from '@/lib/upload-image'

export function uploadIdeaImageToStorage(params: {
  ideaId: string
  file: File
}): Promise<UploadResult> {
  return uploadImage({ kind: 'idea', parentId: params.ideaId, file: params.file })
}
