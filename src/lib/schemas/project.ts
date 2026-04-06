import { z } from 'zod/v4'

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  description: z.string().max(2000).nullable().optional(),
  hobbyId: z.uuid(),
  steps: z
    .array(z.object({ name: z.string().trim().min(1, 'Step name is required').max(200) }))
    .min(1, 'At least one step is required')
    .max(50, 'Maximum 50 steps per project'),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
