'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  updateMaintenanceSchema,
  type CreateInventoryItemInput,
  type UpdateInventoryItemInput,
  type UpdateMaintenanceInput,
  type InventoryItemData,
  type InventoryItemOption,
} from '@/lib/schemas/inventory'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import { nextUniqueInventoryName } from '@/lib/inventory-name'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

function isP2002(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}

function isP2025(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  )
}

export async function createInventoryItem(
  input: CreateInventoryItemInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createInventoryItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findMany({
        where: { isDeleted: false },
        select: { name: true },
      })
      const finalName = nextUniqueInventoryName(
        parsed.data.name,
        existing.map((existingItem) => existingItem.name),
      )
      const hobbyIds = parsed.data.hobbyIds
      return tx.inventoryItem.create({
        data: {
          name: finalName,
          type: parsed.data.type,
          quantity: parsed.data.quantity ?? null,
          unit: parsed.data.unit ?? null,
          notes: parsed.data.notes ?? null,
          ...(hobbyIds && hobbyIds.length > 0
            ? { hobbies: { connect: hobbyIds.map((id) => ({ id })) } }
            : {}),
        },
      })
    })

    revalidatePath('/inventory')
    return { success: true, data: { id: item.id } }
  } catch (error) {
    if (isP2002(error)) {
      return { success: false, error: 'Item name collided — please retry.' }
    }
    if (isP2025(error)) {
      return { success: false, error: 'One or more selected hobbies no longer exist.' }
    }
    console.error('createInventoryItem failed:', error)
    return { success: false, error: 'Failed to add item.' }
  }
}

export async function getInventoryItems(
  typeFilter?: 'MATERIAL' | 'CONSUMABLE' | 'TOOL',
): Promise<ActionResult<InventoryItemData[]>> {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { isDeleted: false, ...(typeFilter ? { type: typeFilter } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { blockers: { where: { isResolved: false } } } },
        hobbies: { select: { id: true, name: true, color: true } },
        images: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true, type: true, storageKey: true, url: true },
        },
      },
    })

    const adapter = getImageStorageAdapter()

    return {
      success: true,
      data: items.map((item) => {
        const heroImage = item.images[0] ?? null
        let heroImageUrl: string | null = null
        let heroThumbnailUrl: string | null = null
        if (heroImage) {
          if (heroImage.type === 'UPLOAD' && heroImage.storageKey && adapter) {
            heroImageUrl = adapter.getPublicUrl(heroImage.storageKey)
            heroThumbnailUrl = adapter.getThumbnailUrl(
              heroImage.storageKey,
              THUMBNAIL_WIDTH.INVENTORY_CARD,
            )
          } else if (heroImage.url) {
            heroImageUrl = heroImage.url
            heroThumbnailUrl = heroImage.url
          }
        }
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
          lastMaintenanceDate: item.lastMaintenanceDate,
          maintenanceIntervalDays: item.maintenanceIntervalDays,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          activeBlockerCount: item._count.blockers,
          hobbies: item.hobbies,
          heroImageUrl,
          heroThumbnailUrl,
        }
      }),
    }
  } catch (error) {
    console.error('getInventoryItems failed:', error)
    return { success: false, error: 'Failed to load inventory.' }
  }
}

export async function updateInventoryItem(
  input: UpdateInventoryItemInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateInventoryItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findUnique({
        where: { id: parsed.data.id },
        select: { name: true },
      })
      if (!current) throw Object.assign(new Error('NOT_FOUND'), { code: 'P2025' })

      let finalName = parsed.data.name
      if (current.name.toLowerCase() !== parsed.data.name.toLowerCase()) {
        const siblings = await tx.inventoryItem.findMany({
          where: { isDeleted: false, id: { not: parsed.data.id } },
          select: { name: true },
        })
        finalName = nextUniqueInventoryName(
          parsed.data.name,
          siblings.map((sibling) => sibling.name),
        )
      }

      return tx.inventoryItem.update({
        where: { id: parsed.data.id },
        data: {
          name: finalName,
          type: parsed.data.type,
          quantity: parsed.data.quantity ?? null,
          unit: parsed.data.unit ?? null,
          notes: parsed.data.notes ?? null,
          ...(parsed.data.hobbyIds !== undefined
            ? { hobbies: { set: parsed.data.hobbyIds.map((id) => ({ id })) } }
            : {}),
        },
      })
    })

    revalidatePath('/inventory')
    return { success: true, data: { id: item.id } }
  } catch (error: unknown) {
    if (isP2002(error)) {
      return { success: false, error: 'Item name collided — please retry.' }
    }
    if (isP2025(error)) {
      const msg =
        error instanceof Error && error.message === 'NOT_FOUND'
          ? 'Item not found.'
          : 'One or more selected hobbies no longer exist.'
      return { success: false, error: msg }
    }
    console.error('updateInventoryItem failed:', error)
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
      await tx.inventoryItem.update({
        where: { id: parsed.data },
        data: { isDeleted: true, deletedAt: new Date() },
      })
    })

    revalidatePath('/inventory')
    return { success: true, data: null }
  } catch (error: unknown) {
    if (isP2025(error)) {
      return { success: false, error: 'Item not found.' }
    }
    console.error('deleteInventoryItem failed:', error)
    return { success: false, error: 'Failed to delete item.' }
  }
}

export async function getInventoryItemOptions(
  hobbyId?: string,
): Promise<ActionResult<InventoryItemOption[]>> {
  if (hobbyId !== undefined) {
    const parsed = z.uuid().safeParse(hobbyId)
    if (!parsed.success) return { success: false, error: 'Invalid hobby ID.' }
  }
  try {
    const where: Record<string, unknown> = { isDeleted: false }
    if (hobbyId) {
      where.OR = [{ hobbies: { some: { id: hobbyId } } }, { hobbies: { none: {} } }]
    }
    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, quantity: true, unit: true },
    })
    return { success: true, data: items }
  } catch (error) {
    console.error('getInventoryItemOptions failed:', error)
    return { success: false, error: 'Failed to load inventory items.' }
  }
}

export async function updateMaintenanceData(
  input: UpdateMaintenanceInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateMaintenanceSchema.safeParse(input)
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: parsed.data.id },
      select: { type: true, isDeleted: true },
    })
    if (!item || item.isDeleted) return { success: false, error: 'Item not found.' }
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
      select: { type: true, maintenanceIntervalDays: true, isDeleted: true },
    })
    if (!item || item.isDeleted) return { success: false, error: 'Item not found.' }
    if (item.type !== 'TOOL') return { success: false, error: 'Maintenance only applies to tools.' }
    if (!item.maintenanceIntervalDays)
      return { success: false, error: 'No maintenance interval configured.' }

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

export type MaintenanceDueItem = {
  id: string
  name: string
  lastMaintenanceDate: Date
  maintenanceIntervalDays: number
  nextDueDate: Date
  daysOverdue: number
}

export async function getOverdueMaintenanceItems(): Promise<ActionResult<MaintenanceDueItem[]>> {
  try {
    const tools = await prisma.inventoryItem.findMany({
      where: {
        isDeleted: false,
        type: 'TOOL',
        lastMaintenanceDate: { not: null },
        maintenanceIntervalDays: { not: null },
      },
      orderBy: { lastMaintenanceDate: 'asc' },
    })

    const { isMaintenanceOverdue, getNextMaintenanceDate, getDaysOverdue } =
      await import('@/lib/maintenance')

    const overdue = tools
      .filter((tool) =>
        isMaintenanceOverdue(tool.lastMaintenanceDate!, tool.maintenanceIntervalDays!),
      )
      .map((tool) => ({
        id: tool.id,
        name: tool.name,
        lastMaintenanceDate: tool.lastMaintenanceDate!,
        maintenanceIntervalDays: tool.maintenanceIntervalDays!,
        nextDueDate: getNextMaintenanceDate(
          tool.lastMaintenanceDate!,
          tool.maintenanceIntervalDays!,
        ),
        daysOverdue: getDaysOverdue(tool.lastMaintenanceDate!, tool.maintenanceIntervalDays!),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)

    return { success: true, data: overdue }
  } catch (error) {
    console.error('getOverdueMaintenanceItems failed:', error)
    return { success: false, error: 'Failed to load maintenance items.' }
  }
}
