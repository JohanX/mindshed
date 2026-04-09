'use server'

import { prisma } from '@/lib/db'
import { createInventoryItemSchema, type CreateInventoryItemInput, type InventoryItemData } from '@/lib/schemas/inventory'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

export async function createInventoryItem(input: CreateInventoryItemInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createInventoryItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const item = await prisma.inventoryItem.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        quantity: parsed.data.quantity ?? null,
        unit: parsed.data.unit ?? null,
        notes: parsed.data.notes ?? null,
      },
    })

    revalidatePath('/inventory')
    return { success: true, data: { id: item.id } }
  } catch (error) {
    console.error('createInventoryItem failed:', error)
    return { success: false, error: 'Failed to add item.' }
  }
}

export async function getInventoryItems(
  typeFilter?: 'MATERIAL' | 'CONSUMABLE' | 'TOOL',
): Promise<ActionResult<InventoryItemData[]>> {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: typeFilter ? { type: typeFilter } : undefined,
      orderBy: { createdAt: 'desc' },
    })

    return { success: true, data: items }
  } catch (error) {
    console.error('getInventoryItems failed:', error)
    return { success: false, error: 'Failed to load inventory.' }
  }
}
