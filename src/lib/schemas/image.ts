import { z } from 'zod/v4'

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

export const addStepImageSchema = z.object({
  stepId: z.uuid(),
  storageKey: z.string().regex(/^steps\/[a-f0-9-]+\/[a-f0-9-]+\.\w+$/, 'Invalid storage key format'),
  originalFilename: z.string().min(1, 'Original filename is required').max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024, 'File too large'),
})

export type AddStepImageInput = z.infer<typeof addStepImageSchema>
