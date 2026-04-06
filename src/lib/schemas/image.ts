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
  storageKey: z.string().min(1, 'Storage key is required'),
  originalFilename: z.string().min(1, 'Original filename is required'),
  contentType: z.string().min(1, 'Content type is required'),
  sizeBytes: z.number().int().positive('File size must be positive'),
})

export type AddStepImageInput = z.infer<typeof addStepImageSchema>
