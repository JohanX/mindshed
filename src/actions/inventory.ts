'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import { createInventoryItemSchema, updateInventoryItemSchema, type CreateInventoryItemInput, type UpdateInventoryItemInput, type InventoryItemData } from '@/lib/schemas/inventory'
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

export async function updateInventoryItem(input: UpdateInventoryItemInput): Promise<ActionResult<{ id: string }>> {
  const parsed = updateInventoryItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const item = await prisma.inventoryItem.update({
      where: { id: parsed.data.id },
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
  } catch (error: unknown) {
    console.error('updateInventoryItem failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Item not found.' }
    }
    return { success: false, error: 'Failed to update item.' }
  }
}

export async function deleteInventoryItem(itemId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(itemId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid item ID.' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // TODO: When Story 11.3 adds inventoryItemId to Blocker, clear those links here:
      // await tx.blocker.updateMany({ where: { inventoryItemId: parsed.data }, data: { inventoryItemId: null } })
      await tx.inventoryItem.delete({ where: { id: parsed.data } })
    })

    revalidatePath('/inventory')
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('deleteInventoryItem failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Item not found.' }
    }
    return { success: false, error: 'Failed to delete item.' }
  }
}
