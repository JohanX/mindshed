import { z } from 'zod/v4'
import { HOBBY_ICON_OPTIONS } from '@/lib/hobby-icons'

// Hobby color palette — 20 swatches arranged around the colour wheel from
// red→warm→green→cool→purple→back to red, each occupying its own hue
// neighbourhood so adjacent swatches in the picker stay distinguishable.
// Lightness varies deliberately (deep/mid/soft mixed within rows) so the
// new 5-col mobile grid still feels tonally rich. The previous "rich /
// vibrant / fresh" banding worked at 7 cols but stopped reading after the
// switch to 5 cols (Story 31.4 follow-up).
export const HOBBY_COLORS = [
  // Walnut leads as a calm warm-brown default for new hobbies.
  { name: 'Walnut', value: 'hsl(25, 45%, 40%)' },
  { name: 'Crimson', value: 'hsl(355, 65%, 42%)' },
  { name: 'Terracotta', value: 'hsl(15, 55%, 55%)' },
  { name: 'Copper', value: 'hsl(25, 70%, 55%)' },
  { name: 'Coral', value: 'hsl(5, 50%, 60%)' },
  { name: 'Peach', value: 'hsl(20, 65%, 68%)' },
  { name: 'Sunshine', value: 'hsl(48, 70%, 62%)' },
  { name: 'Olive', value: 'hsl(75, 35%, 38%)' },
  { name: 'Forest', value: 'hsl(150, 40%, 35%)' },
  { name: 'Mint', value: 'hsl(160, 45%, 60%)' },
  { name: 'Teal', value: 'hsl(175, 35%, 45%)' },
  { name: 'Sky', value: 'hsl(200, 55%, 65%)' },
  { name: 'Denim', value: 'hsl(215, 40%, 50%)' },
  { name: 'Slate', value: 'hsl(210, 15%, 50%)' },
  { name: 'Navy', value: 'hsl(225, 45%, 38%)' },
  { name: 'Indigo', value: 'hsl(245, 45%, 45%)' },
  { name: 'Lavender', value: 'hsl(265, 40%, 65%)' },
  { name: 'Plum', value: 'hsl(280, 30%, 50%)' },
  { name: 'Magenta', value: 'hsl(320, 55%, 50%)' },
  { name: 'Rose', value: 'hsl(340, 45%, 60%)' },
] as const

export const hobbyColorValues = HOBBY_COLORS.map((color) => color.value) as unknown as [
  string,
  ...string[],
]

export const createHobbySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  color: z.enum(hobbyColorValues, { error: 'Please select a valid color' }),
  icon: z
    .enum(HOBBY_ICON_OPTIONS as unknown as [string, ...string[]])
    .nullable()
    .optional(),
  // Story 30.5 / FR129 — opt-in per hobby. When true, the project page
  // renders an hours counter on each step and surfaces project totals on
  // cards / detail page / galleries.
  hoursTrackingEnabled: z.boolean().default(false),
})

// Use z.input so callers can omit fields with `.default()` in the schema
// (e.g., Story 30.5's `hoursTrackingEnabled` defaults to false). Inside the
// action body, `parsed.data` is the resolved output with defaults applied.
export type CreateHobbyInput = z.input<typeof createHobbySchema>

export const updateHobbySchema = createHobbySchema.extend({
  id: z.string().uuid(),
})

export type UpdateHobbyInput = z.input<typeof updateHobbySchema>

export const reorderHobbiesSchema = z.object({
  orderedIds: z
    .array(z.uuid())
    .min(1, 'At least one hobby required')
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate hobby IDs'),
})

export type ReorderHobbiesInput = z.infer<typeof reorderHobbiesSchema>

export type HobbyWithCounts = {
  id: string
  name: string
  color: string
  icon: string | null
  sortOrder: number
  /** Story 30.5 / FR129 — defaults to false (column NOT NULL DEFAULT false). */
  hoursTrackingEnabled: boolean
  createdAt: Date
  updatedAt: Date
  projectCount: number
  activeCount: number
  blockedCount: number
  idleCount: number
}
