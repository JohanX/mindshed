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

export const reorderStepsSchema = z.object({
  projectId: z.uuid(),
  orderedStepIds: z
    .array(z.uuid())
    .min(1, 'At least one step required')
    .max(50, 'Maximum 50 steps')
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate step IDs'),
})

// Story 30.5 / FR129 — record hours spent on a step (per-hobby opt-in).
// Null clears the value (step is back to "not tracked").
export const setStepHoursSchema = z.object({
  id: z.uuid(),
  hours: z
    .number()
    .nullable()
    .refine(
      (v) => v === null || (Number.isFinite(v) && v >= 0 && Math.round(v * 2) === v * 2),
      'Hours must be null or a non-negative multiple of 0.5',
    ),
})

export type CreateStepInput = z.infer<typeof createStepSchema>
export type UpdateStepInput = z.infer<typeof updateStepSchema>
export type UpdateStepStateInput = z.infer<typeof updateStepStateSchema>
export type ReorderStepsInput = z.infer<typeof reorderStepsSchema>
export type SetStepHoursInput = z.infer<typeof setStepHoursSchema>
