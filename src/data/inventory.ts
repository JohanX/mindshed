/**
 * Data access layer for InventoryItem.
 *
 * Handles soft-deleted uniqueness scoping, hobby-filtered autocomplete,
 * and the hero-image URL resolution that powers inventory cards.
 */

import { prisma } from '@/lib/db'
import type { InventoryItemData, InventoryItemOption } from '@/lib/schemas/inventory'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

/** Find a single inventory item (raw row, no relations). */
export async function findInventoryItemById(id: string) {
  return prisma.inventoryItem.findUnique({ where: { id } })
}

/** Active (non-soft-deleted) names — used for the auto-suffix uniqueness pass. */
export async function findActiveInventoryNames(): Promise<string[]> {
  const rows = await prisma.inventoryItem.findMany({
    where: { isDeleted: false },
    select: { name: true },
  })
  return rows.map((r) => r.name)
}

/** Active sibling names (excluding a given id) — used by update flow uniqueness pass. */
export async function findActiveInventoryNamesExcept(id: string): Promise<string[]> {
  const rows = await prisma.inventoryItem.findMany({
    where: { isDeleted: false, id: { not: id } },
    select: { name: true },
  })
  return rows.map((r) => r.name)
}

/**
 * The inventory list with hero image URLs resolved server-side, hobby
 * associations, and active blocker counts.
 */
export async function findInventoryItemsList(
  typeFilter?: 'MATERIAL' | 'CONSUMABLE' | 'TOOL',
): Promise<InventoryItemData[]> {
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

  return items.map((item) => {
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
  })
}

/**
 * BOM autocomplete options. When `hobbyId` is provided, scope to items
 * tagged with that hobby OR untagged items (FR102).
 */
export async function findInventoryItemOptions(hobbyId?: string): Promise<InventoryItemOption[]> {
  const where: Record<string, unknown> = { isDeleted: false }
  if (hobbyId) {
    where.OR = [{ hobbies: { some: { id: hobbyId } } }, { hobbies: { none: {} } }]
  }
  return prisma.inventoryItem.findMany({
    where,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, type: true, quantity: true, unit: true },
  })
}
