import { z } from 'zod/v4'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'

export const addIdeaImageSchema = z.object({
  ideaId: z.uuid(),
  storageKey: z
    .string()
    .regex(/^ideas\/[a-f0-9-]+\/[a-f0-9-]+\.\w+$/, 'Invalid storage key format'),
  originalFilename: z.string().min(1, 'Original filename is required').max(255),
  contentType: z.enum(ACCEPTED_IMAGE_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES, 'File too large'),
})

export type AddIdeaImageInput = z.infer<typeof addIdeaImageSchema>

export const addIdeaImageLinkSchema = z.object({
  ideaId: z.uuid(),
  url: z
    .url()
    .refine(
      (val) => val.startsWith('http://') || val.startsWith('https://'),
      'URL must start with http:// or https://',
    ),
})

export type AddIdeaImageLinkInput = z.infer<typeof addIdeaImageLinkSchema>
