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
 *
 * Story 35.2 / FR134 widens the `kind: 'step'` allow-list to accept
 * video MIMEs (mp4 / quicktime / webm) in addition to image MIMEs.
 * The size cap is content-type-dependent: 10 MB image, 60 MB video.
 * Duration cap (60s) is enforced client-side via `<video>.duration`
 * before this function is called. `kind: 'idea'` and `kind: 'inventory'`
 * continue to reject video MIMEs at the boundary.
 */

import { addStepImage, uploadImageCloudinary } from '@/actions/image'
import {
  addInventoryItemImage,
  uploadInventoryItemImageCloudinary,
} from '@/actions/inventory-image'
import { addIdeaImage, uploadIdeaImageCloudinary } from '@/actions/idea-image'
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_STEP_MEDIA_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
} from '@/lib/constants/image-upload'

export { ACCEPTED_IMAGE_TYPES as ACCEPTED_TYPES, MAX_IMAGE_SIZE_BYTES }
export { ACCEPTED_STEP_MEDIA_TYPES, ACCEPTED_VIDEO_TYPES, MAX_VIDEO_SIZE_BYTES }

export type ImageKind = 'step' | 'inventory' | 'idea'

export type UploadResult = { success: true; key: string } | { success: false; error: string }

type ContentType = string

interface AddRecordInput {
  parentId: string
  storageKey: string
  originalFilename: string
  contentType: ContentType
  sizeBytes: number
  /** Story 35.2 — only step images can be VIDEO. */
  mediaType?: 'IMAGE' | 'VIDEO'
  /** Story 35.2 — required (1-60) when mediaType is VIDEO, null otherwise. */
  durationSeconds?: number | null
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
  /** MIME allow-list for this kind. Step accepts image+video; idea+inventory image-only. */
  acceptedTypes: readonly string[]
}

const STRATEGIES: Record<ImageKind, KindStrategy> = {
  step: {
    presignFieldName: 'stepId',
    addDbRecord: ({
      parentId,
      storageKey,
      originalFilename,
      contentType,
      sizeBytes,
      mediaType,
      durationSeconds,
    }) =>
      addStepImage({
        stepId: parentId,
        storageKey,
        originalFilename,
        // The MIME has already been validated against ACCEPTED_STEP_MEDIA_TYPES
        // upstream in `uploadImage`. The cast narrows the broad `string` type
        // back to the enum union the Zod schema expects.
        contentType: contentType as
          | 'image/jpeg'
          | 'image/png'
          | 'image/webp'
          | 'video/mp4'
          | 'video/quicktime'
          | 'video/webm',
        sizeBytes,
        mediaType: mediaType ?? 'IMAGE',
        durationSeconds: durationSeconds ?? null,
      }),
    cloudinaryUpload: uploadImageCloudinary,
    acceptedTypes: ACCEPTED_STEP_MEDIA_TYPES,
  },
  inventory: {
    presignFieldName: 'inventoryItemId',
    presignPrefix: 'inventory',
    addDbRecord: ({ parentId, storageKey, originalFilename, contentType, sizeBytes }) =>
      addInventoryItemImage({
        inventoryItemId: parentId,
        storageKey,
        originalFilename,
        contentType: contentType as 'image/jpeg' | 'image/png' | 'image/webp',
        sizeBytes,
      }),
    cloudinaryUpload: uploadInventoryItemImageCloudinary,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },
  idea: {
    presignFieldName: 'ideaId',
    presignPrefix: 'ideas',
    addDbRecord: ({ parentId, storageKey, originalFilename, contentType, sizeBytes }) =>
      addIdeaImage({
        ideaId: parentId,
        storageKey,
        originalFilename,
        contentType: contentType as 'image/jpeg' | 'image/png' | 'image/webp',
        sizeBytes,
      }),
    cloudinaryUpload: uploadIdeaImageCloudinary,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  },
}

function isVideoMime(mime: string): boolean {
  return (ACCEPTED_VIDEO_TYPES as readonly string[]).includes(mime)
}

/**
 * Validate, presign, PUT to S3/R2, record in DB. Falls back to Cloudinary
 * when the presign route returns 404/501 (provider not configured) OR when
 * `NEXT_PUBLIC_IMAGE_PROVIDER === 'cloudinary'` (skips the round-trip).
 *
 * Story 35.2: `durationSeconds` is supplied by the client for video
 * uploads (measured via `<video>.duration` before this function is
 * called) and threaded through to the DB record.
 */
export async function uploadImage(params: {
  kind: ImageKind
  parentId: string
  file: File
  /** Story 35.2 — required when uploading a video file (step kind only). */
  durationSeconds?: number | null
}): Promise<UploadResult> {
  const { kind, parentId, file, durationSeconds = null } = params
  const strategy = STRATEGIES[kind]

  if (!strategy.acceptedTypes.includes(file.type)) {
    // Step kind allows image + video; idea/inventory image-only.
    return {
      success: false,
      error:
        kind === 'step'
          ? 'Only JPEG, PNG, WebP images and MP4 / MOV / WebM videos are allowed.'
          : 'Only JPEG, PNG, and WebP images are allowed.',
    }
  }

  const isVideo = isVideoMime(file.type)
  const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES
  if (file.size > maxSize) {
    return {
      success: false,
      error: isVideo ? 'Video must be under 60 MB.' : 'Image must be under 10 MB.',
    }
  }

  if (isVideo && (durationSeconds == null || durationSeconds < 1 || durationSeconds > 60)) {
    return { success: false, error: 'Video duration must be between 1 and 60 seconds.' }
  }

  const provider = process.env.NEXT_PUBLIC_IMAGE_PROVIDER

  // Cloudinary has no presign flow — skip the round-trip that would 404.
  if (provider === 'cloudinary') {
    return uploadViaCloudinary(strategy, parentId, file, durationSeconds)
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
        contentType: file.type,
        sizeBytes: file.size,
        mediaType: isVideo ? 'VIDEO' : 'IMAGE',
        durationSeconds: isVideo ? durationSeconds : null,
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

  return uploadViaCloudinary(strategy, parentId, file, durationSeconds)
}

async function uploadViaCloudinary(
  strategy: KindStrategy,
  parentId: string,
  file: File,
  durationSeconds: number | null,
): Promise<UploadResult> {
  try {
    const formData = new FormData()
    formData.append(strategy.presignFieldName, parentId)
    formData.append('file', file)
    if (durationSeconds != null) {
      formData.append('durationSeconds', String(durationSeconds))
    }
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
  /** Story 35.2 — required for video files (mediaType inferred from MIME). */
  durationSeconds?: number | null
}): Promise<UploadResult> {
  return uploadImage({
    kind: 'step',
    parentId: params.stepId,
    file: params.file,
    durationSeconds: params.durationSeconds,
  })
}
