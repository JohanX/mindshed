'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import { createInventoryItemSchema, updateInventoryItemSchema, updateMaintenanceSchema, type CreateInventoryItemInput, type UpdateInventoryItemInput, type UpdateMaintenanceInput, type InventoryItemData, type InventoryItemOption } from '@/lib/schemas/inventory'
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
      include: { _count: { select: { blockers: { where: { isResolved: false } } } } },
    })

    return {
      success: true,
      data: items.map(i => ({
        ...i,
        activeBlockerCount: i._count.blockers,
      })),
    }
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
      await tx.blocker.updateMany({ where: { inventoryItemId: parsed.data }, data: { inventoryItemId: null } })
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

export async function getInventoryItemOptions(): Promise<ActionResult<InventoryItemOption[]>> {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    })
    return { success: true, data: items }
  } catch (error) {
    console.error('getInventoryItemOptions failed:', error)
    return { success: false, error: 'Failed to load inventory items.' }
  }
}

export async function updateMaintenanceData(input: UpdateMaintenanceInput): Promise<ActionResult<{ id: string }>> {
  const parsed = updateMaintenanceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  try {
    const item = await prisma.inventoryItem.findUnique({ where: { id: parsed.data.id }, select: { type: true } })
    if (!item) return { success: false, error: 'Item not found.' }
    if (item.type !== 'TOOL') return { success: false, error: 'Maintenance only applies to tools.' }

    const updated = await prisma.inventoryItem.update({
      where: { id: parsed.data.id },
      data: {
        lastMaintenanceDate: parsed.data.lastMaintenanceDate,
        maintenanceIntervalDays: parsed.data.maintenanceIntervalDays,
      },
    })

    revalidatePath('/inventory')
    revalidatePath('/')
    return { success: true, data: { id: updated.id } }
  } catch (error) {
    console.error('updateMaintenanceData failed:', error)
    return { success: false, error: 'Failed to update maintenance data.' }
  }
}

export async function recordMaintenance(itemId: string): Promise<ActionResult<{ id: string }>> {
  const parsed = z.uuid().safeParse(itemId)
  if (!parsed.success) return { success: false, error: 'Invalid item ID.' }

  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: parsed.data },
      select: { type: true, maintenanceIntervalDays: true },
    })
    if (!item) return { success: false, error: 'Item not found.' }
    if (item.type !== 'TOOL') return { success: false, error: 'Maintenance only applies to tools.' }
    if (!item.maintenanceIntervalDays) return { success: false, error: 'No maintenance interval configured.' }

    const updated = await prisma.inventoryItem.update({
      where: { id: parsed.data },
      data: { lastMaintenanceDate: new Date() },
    })

    revalidatePath('/inventory')
    revalidatePath('/')
    return { success: true, data: { id: updated.id } }
  } catch (error) {
    console.error('recordMaintenance failed:', error)
    return { success: false, error: 'Failed to record maintenance.' }
  }
}
