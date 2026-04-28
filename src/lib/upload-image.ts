/**
 * Unified image upload mechanism for steps, inventory items, and ideas.
 *
 * Story 25.4 collapsed three near-identical client-side uploaders
 * (`upload-image.ts`, `upload-inventory-image.ts`, `upload-idea-image.ts`)
 * into a single function that takes a `kind` discriminator and a
 * strategy registry. Per-kind specifics — presign-route field name,
 * presign prefix, DB-record action, Cloudinary action, FormData field —
 * are isolated to the registry, so future entities (e.g. hobby cover,
 * project hero) can adopt the same path by adding a registry entry.
 *
 * The thin per-entity wrappers (`uploadImageToStorage`,
 * `uploadInventoryImageToStorage`, `uploadIdeaImageToStorage`) remain as
 * re-exports for backwards compatibility with existing callers.
 */

import { addStepImage, uploadImageCloudinary } from '@/actions/image'
import {
  addInventoryItemImage,
  uploadInventoryItemImageCloudinary,
} from '@/actions/inventory-image'
import { addIdeaImage, uploadIdeaImageCloudinary } from '@/actions/idea-image'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'

export { ACCEPTED_IMAGE_TYPES as ACCEPTED_TYPES, MAX_IMAGE_SIZE_BYTES }

export type ImageKind = 'step' | 'inventory' | 'idea'

export type UploadResult = { success: true; key: string } | { success: false; error: string }

type ContentType = 'image/jpeg' | 'image/png' | 'image/webp'

interface AddRecordInput {
  parentId: string
  storageKey: string
  originalFilename: string
  contentType: ContentType
  sizeBytes: number
}

type ActionResultLike = { success: true; data?: unknown } | { success: false; error: string }

interface KindStrategy {
  /** Field name in the presign request body (`stepId` / `inventoryItemId` / `ideaId`). */
  presignFieldName: string
  /** Optional prefix passed to the presign route (only inventory + idea use one). */
  presignPrefix?: string
  /** Server action that records the uploaded image in the DB. */
  addDbRecord: (input: AddRecordInput) => Promise<ActionResultLike>
  /** Cloudinary fallback action — accepts a FormData with the parent id field + file. */
  cloudinaryUpload: (formData: FormData) => Promise<ActionResultLike>
}

const STRATEGIES: Record<ImageKind, KindStrategy> = {
  step: {
    presignFieldName: 'stepId',
    addDbRecord: ({ parentId, storageKey, originalFilename, contentType, sizeBytes }) =>
      addStepImage({ stepId: parentId, storageKey, originalFilename, contentType, sizeBytes }),
    cloudinaryUpload: uploadImageCloudinary,
  },
  inventory: {
    presignFieldName: 'inventoryItemId',
    presignPrefix: 'inventory',
    addDbRecord: ({ parentId, storageKey, originalFilename, contentType, sizeBytes }) =>
      addInventoryItemImage({
        inventoryItemId: parentId,
        storageKey,
        originalFilename,
        contentType,
        sizeBytes,
      }),
    cloudinaryUpload: uploadInventoryItemImageCloudinary,
  },
  idea: {
    presignFieldName: 'ideaId',
    presignPrefix: 'ideas',
    addDbRecord: ({ parentId, storageKey, originalFilename, contentType, sizeBytes }) =>
      addIdeaImage({ ideaId: parentId, storageKey, originalFilename, contentType, sizeBytes }),
    cloudinaryUpload: uploadIdeaImageCloudinary,
  },
}

/**
 * Validate, presign, PUT to S3/R2, record in DB. Falls back to Cloudinary
 * when the presign route returns 404/501 (provider not configured) OR when
 * `NEXT_PUBLIC_IMAGE_PROVIDER === 'cloudinary'` (skips the round-trip).
 */
export async function uploadImage(params: {
  kind: ImageKind
  parentId: string
  file: File
}): Promise<UploadResult> {
  const { kind, parentId, file } = params
  const strategy = STRATEGIES[kind]

  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { success: false, error: 'Only JPEG, PNG, and WebP images are allowed.' }
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { success: false, error: 'Image must be under 10 MB.' }
  }

  const provider = process.env.NEXT_PUBLIC_IMAGE_PROVIDER

  // Cloudinary has no presign flow — skip the round-trip that would 404.
  if (provider === 'cloudinary') {
    return uploadViaCloudinary(strategy, parentId, file)
  }

  // Try S3/R2 presigned upload first
  try {
    const presignBody: Record<string, unknown> = {
      [strategy.presignFieldName]: parentId,
      filename: file.name,
      contentType: file.type,
    }
    if (strategy.presignPrefix) presignBody.prefix = strategy.presignPrefix

    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(presignBody),
    })

    if (presignRes.ok) {
      const { url, key } = (await presignRes.json()) as { url: string; key: string }
      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadRes.ok) {
        return { success: false, error: 'Upload to storage failed' }
      }

      const result = await strategy.addDbRecord({
        parentId,
        storageKey: key,
        originalFilename: file.name,
        contentType: file.type as ContentType,
        sizeBytes: file.size,
      })
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true, key }
    }

    // 404/501 = not S3 mode, fall through to Cloudinary
    if (presignRes.status !== 404 && presignRes.status !== 501) {
      return { success: false, error: 'Failed to get upload URL' }
    }
  } catch {
    return { success: false, error: 'Upload failed — try again' }
  }

  return uploadViaCloudinary(strategy, parentId, file)
}

async function uploadViaCloudinary(
  strategy: KindStrategy,
  parentId: string,
  file: File,
): Promise<UploadResult> {
  try {
    const formData = new FormData()
    formData.append(strategy.presignFieldName, parentId)
    formData.append('file', file)
    const result = await strategy.cloudinaryUpload(formData)
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, key: 'cloudinary' }
  } catch {
    return { success: false, error: 'Upload failed — try again' }
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible thin wrappers (kept so existing callers don't change).
// New code should call `uploadImage({ kind, parentId, file })` directly.
// ---------------------------------------------------------------------------

export function uploadImageToStorage(params: {
  stepId: string
  file: File
}): Promise<UploadResult> {
  return uploadImage({ kind: 'step', parentId: params.stepId, file: params.file })
}
