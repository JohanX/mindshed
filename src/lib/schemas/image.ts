import { z } from 'zod/v4'
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_STEP_MEDIA_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_SIZE_BYTES,
} from '@/lib/constants/image-upload'

export const addImageLinkSchema = z.object({
  stepId: z.uuid(),
  url: z
    .url()
    .refine(
      (val) => val.startsWith('http://') || val.startsWith('https://'),
      'URL must start with http:// or https://',
    ),
})

export type AddImageLinkInput = z.infer<typeof addImageLinkSchema>

// Story 35.2 / FR134 — step images accept video MIMEs (mp4 / mov / webm)
// in addition to image MIMEs. The size cap is content-type-dependent: 10 MB
// for image, 60 MB for video. Duration cap (60s) applies to VIDEO only;
// IMAGE rows MUST carry `durationSeconds: null`.
export const addStepImageSchema = z
  .object({
    stepId: z.uuid(),
    // Story 35.5 / FR138 code-review patch (Blind/Edge HIGH-1):
    // S3-style keys are `steps/<uuid>/<uuid>.<ext>` (lowercase hex + ext);
    // Cloudinary direct-upload public_ids are `steps/<uuid>/<server-random>`
    // with mixed-case alphanumeric segments and NO extension. The regex
    // accepts both shapes — the second segment is `[A-Za-z0-9_-]+` with
    // an optional trailing `.<ext>`. Without this widening, every prod
    // direct-upload would be rejected here and orphan-cleaned after a
    // successful upload (silent data loss).
    storageKey: z
      .string()
      .regex(/^steps\/[a-f0-9-]+\/[A-Za-z0-9_-]+(\.\w+)?$/, 'Invalid storage key format'),
    originalFilename: z.string().min(1, 'Original filename is required').max(255),
    contentType: z.enum(ACCEPTED_STEP_MEDIA_TYPES),
    sizeBytes: z.number().int().positive(),
    mediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
    durationSeconds: z
      .number()
      .int()
      .min(1)
      .max(MAX_VIDEO_DURATION_SECONDS)
      .nullable()
      .default(null),
  })
  .refine(
    (data) => {
      if (data.mediaType === 'VIDEO') {
        return data.durationSeconds !== null
      }
      // IMAGE
      return data.durationSeconds === null
    },
    {
      message: 'durationSeconds must be a 1-60 integer for VIDEO and null for IMAGE',
      path: ['durationSeconds'],
    },
  )
  .refine(
    (data) => {
      if (data.mediaType === 'VIDEO') {
        return (
          (ACCEPTED_VIDEO_TYPES as readonly string[]).includes(data.contentType) &&
          data.sizeBytes <= MAX_VIDEO_SIZE_BYTES
        )
      }
      return (
        (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(data.contentType) &&
        data.sizeBytes <= MAX_IMAGE_SIZE_BYTES
      )
    },
    {
      message: 'contentType / sizeBytes does not match mediaType',
      path: ['contentType'],
    },
  )

export type AddStepImageInput = z.infer<typeof addStepImageSchema>
