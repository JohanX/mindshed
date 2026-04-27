/**
 * Data access layer for BomItem.
 *
 * BOM rows always render with the linked inventory item's hero photo
 * (via `findBomItemsByProject`'s rich include shape). The
 * `findDistinctProjectsForInventoryItem` query powers the BOM project
 * path revalidation pattern that lives in `actions/inventory-image.ts`.
 */

import { prisma } from '@/lib/db'
import type { BomItemData } from '@/lib/bom'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

/** Find a single BOM row (no relations). */
export async function findBomItemById(id: string) {
  return prisma.bomItem.findUnique({ where: { id } })
}

/**
 * BOM rows for a project, ordered by sortOrder, with inventory item +
 * hero thumbnail URL resolved server-side. Mirrors the shape consumed by
 * `<BomSection>` and embedded directly into the project detail page.
 */
export async function findBomItemsByProject(projectId: string): Promise<BomItemData[]> {
  const rows = await prisma.bomItem.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
    include: {
      inventoryItem: {
        select: {
          id: true,
          name: true,
          type: true,
          quantity: true,
          isDeleted: true,
          images: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { id: true, type: true, storageKey: true, url: true },
          },
        },
      },
    },
  })

  const adapter = getImageStorageAdapter()

  return rows.map((row) => {
    let heroThumbnailUrl: string | null = null
    const heroImage = row.inventoryItem?.images?.[0] ?? null
    if (heroImage) {
      if (heroImage.type === 'UPLOAD' && heroImage.storageKey && adapter) {
        heroThumbnailUrl = adapter.getThumbnailUrl(heroImage.storageKey, THUMBNAIL_WIDTH.BOM_ROW)
      } else if (heroImage.url) {
        heroThumbnailUrl = heroImage.url
      }
    }
    return {
      id: row.id,
      label: row.label,
      requiredQuantity: row.requiredQuantity,
      unit: row.unit,
      sortOrder: row.sortOrder,
      consumptionState: row.consumptionState,
      inventoryItem: row.inventoryItem
        ? {
            id: row.inventoryItem.id,
            name: row.inventoryItem.name,
            type: row.inventoryItem.type,
            quantity: row.inventoryItem.quantity,
            isDeleted: row.inventoryItem.isDeleted,
            heroThumbnailUrl,
          }
        : null,
    }
  })
}

/**
 * Distinct (projectId, hobbyId) pairs for projects that reference an
 * inventory item via a BOM row. Powers `revalidateBomProjectPaths` in
 * `actions/inventory-image.ts`.
 */
export async function findDistinctProjectsForInventoryItem(
  inventoryItemId: string,
): Promise<{ id: string; hobbyId: string }[]> {
  const rows = await prisma.bomItem.findMany({
    where: { inventoryItemId },
    select: { project: { select: { id: true, hobbyId: true } } },
    distinct: ['projectId'],
  })
  return rows.map((row) => ({ id: row.project.id, hobbyId: row.project.hobbyId }))
}
