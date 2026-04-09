import { z } from 'zod/v4'

export const inventoryItemTypeEnum = z.enum(['MATERIAL', 'CONSUMABLE', 'TOOL'])

export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  type: inventoryItemTypeEnum,
  quantity: z.number().min(0, 'Quantity must be 0 or more').optional(),
  unit: z.string().trim().max(50, 'Unit must be 50 characters or less').optional(),
  notes: z.string().trim().max(500, 'Notes must be 500 characters or less').optional(),
})

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>

export const updateInventoryItemSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  type: inventoryItemTypeEnum,
  quantity: z.number().min(0, 'Quantity must be 0 or more').optional(),
  unit: z.string().trim().max(50, 'Unit must be 50 characters or less').optional(),
  notes: z.string().trim().max(500, 'Notes must be 500 characters or less').optional(),
})

export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>

export type InventoryItemOption = {
  id: string
  name: string
  type: 'MATERIAL' | 'CONSUMABLE' | 'TOOL'
}

export type InventoryItemData = {
  id: string
  name: string
  type: 'MATERIAL' | 'CONSUMABLE' | 'TOOL'
  quantity: number | null
  unit: string | null
  notes: string | null
  activeBlockerCount: number
  createdAt: Date
  updatedAt: Date
}
