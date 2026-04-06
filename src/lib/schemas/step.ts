import { z } from 'zod/v4'

export const createStepSchema = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1, 'Step name is required').max(200),
})

export const updateStepSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, 'Step name is required').max(200),
})

export const updateStepStateSchema = z.object({
  id: z.uuid(),
  state: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']),
})

export type CreateStepInput = z.infer<typeof createStepSchema>
export type UpdateStepInput = z.infer<typeof updateStepSchema>
export type UpdateStepStateInput = z.infer<typeof updateStepStateSchema>
