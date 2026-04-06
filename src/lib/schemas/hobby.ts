import { z } from 'zod/v4'
import { HOBBY_ICON_OPTIONS } from '@/lib/hobby-icons'

export const HOBBY_COLORS = [
  { name: 'Terracotta', value: 'hsl(15, 55%, 55%)' },
  { name: 'Walnut', value: 'hsl(25, 45%, 40%)' },
  { name: 'Denim', value: 'hsl(215, 40%, 50%)' },
  { name: 'Sage', value: 'hsl(140, 25%, 45%)' },
  { name: 'Copper', value: 'hsl(25, 70%, 55%)' },
  { name: 'Slate', value: 'hsl(210, 15%, 50%)' },
  { name: 'Plum', value: 'hsl(280, 30%, 50%)' },
  { name: 'Teal', value: 'hsl(175, 35%, 45%)' },
  { name: 'Ochre', value: 'hsl(45, 60%, 50%)' },
  { name: 'Moss', value: 'hsl(100, 25%, 40%)' },
  { name: 'Coral', value: 'hsl(5, 50%, 60%)' },
  { name: 'Storm', value: 'hsl(220, 25%, 45%)' },
] as const

export const hobbyColorValues = HOBBY_COLORS.map(c => c.value) as unknown as [string, ...string[]]

export const createHobbySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  color: z.enum(hobbyColorValues, { error: 'Please select a valid color' }),
  icon: z.enum(HOBBY_ICON_OPTIONS as unknown as [string, ...string[]]).nullable().optional(),
})

export type CreateHobbyInput = z.infer<typeof createHobbySchema>

export const updateHobbySchema = createHobbySchema.extend({
  id: z.string().uuid(),
})

export type UpdateHobbyInput = z.infer<typeof updateHobbySchema>

export const reorderHobbiesSchema = z.object({
  orderedIds: z.array(z.uuid()).min(1, 'At least one hobby required')
    .refine(ids => new Set(ids).size === ids.length, 'Duplicate hobby IDs'),
})

export type ReorderHobbiesInput = z.infer<typeof reorderHobbiesSchema>

export type HobbyWithCounts = {
  id: string
  name: string
  color: string
  icon: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  projectCount: number
  activeCount: number
  blockedCount: number
  idleCount: number
}
