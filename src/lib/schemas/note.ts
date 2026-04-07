import { z } from 'zod/v4'

export const createNoteSchema = z.object({
  stepId: z.uuid(),
  text: z.string().trim().min(1, 'Note text is required').max(2000, 'Note must be 2000 characters or fewer'),
})

export type CreateNoteInput = z.infer<typeof createNoteSchema>

export const updateNoteSchema = z.object({
  id: z.uuid(),
  text: z.string().trim().min(1, 'Note text is required').max(2000, 'Note must be 2000 characters or fewer'),
})

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
