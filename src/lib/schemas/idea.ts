import { z } from 'zod/v4'

export const createIdeaSchema = z.object({
  hobbyId: z.uuid('Invalid hobby ID'),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title must be under 200 characters'),
  description: z
    .string()
    .max(2000, 'Description must be under 2000 characters')
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
  referenceLink: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === '' || v == null ? null : v))
    .pipe(z.url('Please enter a valid URL').nullable()),
})

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>

export const updateIdeaSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
  referenceLink: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === '' || v == null ? null : v))
    .pipe(z.url('Please enter a valid URL').nullable()),
})

export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>
