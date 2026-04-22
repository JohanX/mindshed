import { z } from 'zod/v4'
import { inventoryItemTypeEnum } from './inventory'

export const addBomItemSchema = z
  .object({
    projectId: z.uuid(),
    label: z.string().trim().min(1).max(100).optional(),
    inventoryItemId: z.uuid().optional(),
    // Allow 0 on add — picking from the combobox creates a row with 0 required
    // and the user edits the real value in-row. Update path enforces positive.
    requiredQuantity: z.number().min(0, 'Required quantity must be 0 or more'),
    unit: z.string().trim().max(50).optional(),
  })
  .refine(
    (data) => (data.label ? !data.inventoryItemId : !!data.inventoryItemId),
    { message: 'Provide exactly one of: label (free-form) OR inventoryItemId (linked)' },
  )

export type AddBomItemInput = z.infer<typeof addBomItemSchema>

export const updateBomItemSchema = z
  .object({
    id: z.uuid(),
    requiredQuantity: z.number().positive('Required quantity must be greater than 0').optional(),
    unit: z.string().trim().max(50).nullable().optional(),
    label: z.string().trim().min(1).max(100).optional(),
  })
  .refine(
    (data) =>
      data.requiredQuantity !== undefined || data.unit !== undefined || data.label !== undefined,
    { message: 'At least one of requiredQuantity, unit, or label must be provided' },
  )

export type UpdateBomItemInput = z.infer<typeof updateBomItemSchema>

export const addBomItemWithNewInventorySchema = z.object({
  projectId: z.uuid(),
  newItem: z.object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    type: inventoryItemTypeEnum,
    startingQuantity: z.number().min(0, 'Starting quantity must be 0 or more').optional(),
    unit: z.string().trim().max(50).optional(),
  }),
  requiredQuantity: z.number().positive('Required quantity must be greater than 0'),
  unit: z.string().trim().max(50).optional(),
})

export type AddBomItemWithNewInventoryInput = z.infer<
  typeof addBomItemWithNewInventorySchema
>

export const createBomShortageBlockerSchema = z.object({
  bomItemId: z.uuid(),
  stepId: z.uuid(),
})
export type CreateBomShortageBlockerInput = z.infer<typeof createBomShortageBlockerSchema>

export const markBomItemConsumedSchema = z.object({
  id: z.uuid(),
})
export type MarkBomItemConsumedInput = z.infer<typeof markBomItemConsumedSchema>

export const undoBomItemConsumptionSchema = z.object({
  id: z.uuid(),
})
export type UndoBomItemConsumptionInput = z.infer<typeof undoBomItemConsumptionSchema>
