import { z } from 'zod/v4'

export const createBlockerSchema = z.object({
  stepId: z.uuid(),
  description: z.string().trim().min(1, 'Description is required').max(500, 'Description must be 500 characters or less'),
  inventoryItemId: z.uuid().optional(),
})

export type CreateBlockerInput = z.infer<typeof createBlockerSchema>

export const resolveBlockerSchema = z.object({
  blockerId: z.uuid(),
})

export type ResolveBlockerInput = z.infer<typeof resolveBlockerSchema>

export const updateBlockerSchema = z.object({
  id: z.uuid(),
  description: z.string().trim().min(1, 'Description is required').max(500, 'Description must be 500 characters or less'),
  inventoryItemId: z.uuid().nullable().optional(),
})

export type UpdateBlockerInput = z.infer<typeof updateBlockerSchema>

/** Blocker with navigation context (step, project, hobby). */
export type BlockerWithContext = {
  id: string
  description: string
  isResolved: boolean
  createdAt: Date
  step: {
    name: string
    project: {
      id: string
      name: string
      hobbyId: string
      hobby: {
        id: string
        name: string
        color: string
        icon: string | null
      }
    }
  }
}
