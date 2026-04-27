/**
 * Data access layer for Blocker.
 */

import { prisma } from '@/lib/db'
import type { BlockerWithContext } from '@/lib/schemas/blocker'

/** Find a single blocker by id (no relations). */
export async function findBlockerById(id: string) {
  return prisma.blocker.findUnique({ where: { id } })
}

/**
 * All unresolved blockers across the system, with step + project + hobby
 * context. Powers the dashboard "Active Blockers" section.
 */
export async function findActiveBlockers(): Promise<BlockerWithContext[]> {
  return prisma.blocker.findMany({
    where: { isResolved: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      description: true,
      isResolved: true,
      createdAt: true,
      step: {
        select: {
          id: true,
          name: true,
          project: {
            select: {
              id: true,
              name: true,
              hobbyId: true,
              hobby: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  icon: true,
                },
              },
            },
          },
        },
      },
    },
  })
}

/**
 * BOM-shortage dedup query: is there an unresolved blocker on this step
 * already linked to this inventory item? Used by the per-row "Create
 * blocker..." action to prevent duplicates.
 */
export async function findUnresolvedBlockerForStepAndItem(stepId: string, inventoryItemId: string) {
  return prisma.blocker.findFirst({
    where: { stepId, inventoryItemId, isResolved: false },
    select: { id: true },
  })
}
