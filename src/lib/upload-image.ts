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

  // Story 35.5 / FR138 — three-path dispatch when provider is Cloudinary:
  //
  //   VIDEO + cloudinary → uploadViaCloudinaryDirect (browser → Cloudinary)
  //     Bypasses Vercel's ~4.5 MB serverless function body limit. Closes
  //     the 2026-05-15 prod incident where a 7.5 MB iPhone clip → 413
  //     because the old Server Action path proxies bytes through Vercel.
  //
  //   IMAGE + cloudinary → uploadViaCloudinary (Server Action — unchanged)
  //     Camera JPEGs fit comfortably under Vercel's edge limit, and the
  //     existing single-round-trip path is faster than the new direct
  //     path's two round-trips (sign → upload → addStepImage = 3 calls).
  //
  //   any provider + S3 → existing presign-then-PUT (Epic 22, unchanged)
  //     Browser uploads directly to R2/MinIO via presigned URL.
  //
  // See `architecture.md` § "Cloudinary Direct-Upload (Browser → Cloudinary,
  // FR138)" for the full decision record.
  if (provider === 'cloudinary') {
    if (isVideo) {
      return uploadViaCloudinaryDirect(strategy, parentId, file, durationSeconds)
    }
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

/**
 * Story 35.5 / FR138 — browser-direct upload to Cloudinary.
 *
 * Flow:
 *   1. Request a signature from `/api/upload/cloudinary-sign`. Tiny
 *      payload — never touches Vercel's body limit.
 *   2. POST the file as multipart/form-data to api.cloudinary.com.
 *      File bytes never traverse Vercel.
 *   3. Call `addStepImage` (via `strategy.addDbRecord`) with the
 *      returned `public_id`. The action's existing post-validation +
 *      post-DB-transaction cleanup paths in `addStepImage` handle
 *      orphan cleanup for the validation/cap-full failure modes —
 *      no client-side `adapter.deleteObject` call needed (and not
 *      possible from a browser context anyway).
 *
 * In V1 this path is wired only for VIDEO + cloudinary (the only
 * combination that routinely exceeds Vercel's body limit). IMAGE +
 * cloudinary continues on the Server Action path. See `uploadImage`
 * dispatch comment.
 */
async function uploadViaCloudinaryDirect(
  strategy: KindStrategy,
  parentId: string,
  file: File,
  durationSeconds: number | null,
): Promise<UploadResult> {
  try {
    // Step 1 — request signature. `folder` is server-sandboxed (regex
    // gate in the route handler); the client supplies the parent id
    // and the route refuses anything outside `steps/<uuid>`.
    const signRes = await fetch('/api/upload/cloudinary-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder: `steps/${parentId}`,
        resourceType: 'video',
      }),
    })
    if (!signRes.ok) {
      return { success: false, error: 'Failed to authorise upload — try again' }
    }
    const { timestamp, signature, apiKey, cloudName, folder, resourceType } =
      (await signRes.json()) as {
        timestamp: number
        signature: string
        apiKey: string
        cloudName: string
        folder: string
        resourceType: 'image' | 'video'
      }

    // Step 2 — multipart POST to Cloudinary. Field set + order:
    //   file, timestamp, signature, api_key, folder, resource_type
    // Cloudinary sorts internally; the signature was computed over
    // `folder` + `timestamp` only, per the FR138 spec.
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`
    const uploadForm = new FormData()
    uploadForm.append('file', file)
    uploadForm.append('timestamp', String(timestamp))
    uploadForm.append('signature', signature)
    uploadForm.append('api_key', apiKey)
    uploadForm.append('folder', folder)
    // `resource_type` is part of the URL path; Cloudinary's REST API
    // does NOT want it in the form body. Omit it to avoid a duplicate-
    // param 400.

    const uploadRes = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: uploadForm,
    })
    if (!uploadRes.ok) {
      return { success: false, error: 'Upload to Cloudinary failed — try again' }
    }
    const cloudinaryResponse = (await uploadRes.json()) as {
      public_id: string
      secure_url: string
      duration?: number
      bytes: number
      format: string
      resource_type: 'image' | 'video'
    }

    // Step 3 — record the upload in our DB. `format` is Cloudinary's
    // authoritative post-upload extension (matches the contentType
    // shape Zod expects on the action boundary). For VIDEO uploads
    // we prefer Cloudinary's reported `duration` but FALL BACK to the
    // client-measured `durationSeconds` when Cloudinary omits it (rare
    // — happens on certain transcoding edge cases). Story 35.2's
    // deferred HIGH "server-side duration probing" is effectively
    // closed for THIS path: Cloudinary IS the server-side probe.
    //
    // Code-review patch (Blind/Edge HIGH-2 + HIGH-3): clamp the
    // duration to the schema's 1-60 inclusive range. Cloudinary
    // boundary values (e.g. 0.4 → Math.round → 0; 60.7 → 61) would
    // otherwise fail validation AFTER a successful upload, orphaning
    // the bytes. The client probe already rejected anything truly
    // out-of-range before we ever hit this code path.
    const isVideoResponse = cloudinaryResponse.resource_type === 'video'
    const inferredContentType = `${isVideoResponse ? 'video' : 'image'}/${cloudinaryResponse.format === 'mov' ? 'quicktime' : cloudinaryResponse.format}`
    const clampDuration = (raw: number): number => Math.max(1, Math.min(60, Math.round(raw)))
    const recordedDuration = isVideoResponse
      ? cloudinaryResponse.duration != null
        ? clampDuration(cloudinaryResponse.duration)
        : durationSeconds != null
          ? clampDuration(durationSeconds)
          : null
      : null
    const result = await strategy.addDbRecord({
      parentId,
      storageKey: cloudinaryResponse.public_id,
      originalFilename: file.name,
      contentType: inferredContentType,
      sizeBytes: cloudinaryResponse.bytes,
      mediaType: isVideoResponse ? 'VIDEO' : 'IMAGE',
      durationSeconds: recordedDuration,
    })
    // addStepImage handles its own orphan cleanup on validation OR
    // DB-transaction failure (see `actions/image.ts`). The client
    // path simply propagates the typed error to the toast layer.
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, key: cloudinaryResponse.public_id }
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
