import { z } from 'zod/v4'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'

export const addInventoryItemImageSchema = z.object({
  inventoryItemId: z.uuid(),
  storageKey: z
    .string()
    .regex(/^inventory\/[a-f0-9-]+\/[a-f0-9-]+\.\w+$/, 'Invalid storage key format'),
  originalFilename: z.string().min(1, 'Original filename is required').max(255),
  contentType: z.enum(ACCEPTED_IMAGE_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES, 'File too large'),
})

export type AddInventoryItemImageInput = z.infer<typeof addInventoryItemImageSchema>

export const addInventoryItemImageLinkSchema = z.object({
  inventoryItemId: z.uuid(),
  url: z
    .url()
    .refine(
      (val) => val.startsWith('http://') || val.startsWith('https://'),
      'URL must start with http:// or https://',
    ),
})

export type AddInventoryItemImageLinkInput = z.infer<typeof addInventoryItemImageLinkSchema>
