import { z } from 'zod/v4'

export const createBlockerSchema = z.object({
  stepId: z.uuid(),
  description: z.string().trim().min(1, 'Description is required').max(500, 'Description must be 500 characters or less'),
})

export type CreateBlockerInput = z.infer<typeof createBlockerSchema>
