/**
 * Data access layer for tool maintenance.
 *
 * Maintenance lives on `InventoryItem` (only TOOL type uses it), so this
 * module is colocated with inventory but kept as a separate export surface
 * for clarity. The action layer composes overdue detection from these
 * primitives + pure helpers in `lib/maintenance.ts`.
 */

import { prisma } from '@/lib/db'

/**
 * Find all TOOL-type inventory items that have a maintenance schedule
 * configured (lastMaintenanceDate + maintenanceIntervalDays both set) and
 * are not soft-deleted. Caller filters down to overdue using the pure
 * helpers in `lib/maintenance.ts`.
 */
export async function findScheduledMaintenanceTools() {
  return prisma.inventoryItem.findMany({
    where: {
      isDeleted: false,
      type: 'TOOL',
      lastMaintenanceDate: { not: null },
      maintenanceIntervalDays: { not: null },
    },
    orderBy: { lastMaintenanceDate: 'asc' },
  })
}

/** Minimal projection: type + maintenance fields + isDeleted, used for pre-mutation checks. */
export async function findInventoryItemMaintenance(id: string) {
  return prisma.inventoryItem.findUnique({
    where: { id },
    select: { type: true, isDeleted: true, maintenanceIntervalDays: true },
  })
}
