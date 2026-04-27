/**
 * Data access layer for Hobby. Pure async functions over Prisma.
 *
 * Contract (per architecture.md § "Data Access Layer"):
 *   - Returns plain values; `null` for not-found.
 *   - Throws on system errors (DB unreachable, constraint violations).
 *   - No `ActionResult` wrapping — that's the action layer's job.
 *   - No `revalidatePath` — that's the action layer's job.
 */

import { prisma } from '@/lib/db'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

/** Find a single hobby by id. Returns null when no row matches. */
export async function findHobbyById(id: string) {
  return prisma.hobby.findUnique({ where: { id } })
}

/** Minimal projection used by pages that just need name+color+icon. */
export async function findHobbyHeader(id: string) {
  return prisma.hobby.findUnique({
    where: { id },
    select: { id: true, name: true, color: true, icon: true },
  })
}

/**
 * Hobbies + per-hobby counts (total projects, active, blocked, idle).
 * Replaces the previous nested-include pattern with 4 parallel groupBy
 * aggregates (Story 18.2). Caller passes the idle-threshold date so this
 * function stays settings-agnostic.
 */
export async function findHobbiesWithCounts(idleThreshold: Date): Promise<HobbyWithCounts[]> {
  const [hobbies, activeCounts, blockedCounts, idleCounts] = await Promise.all([
    prisma.hobby.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { projects: true } } },
    }),
    prisma.project.groupBy({
      by: ['hobbyId'],
      where: { isArchived: false, isCompleted: false },
      _count: { _all: true },
    }),
    prisma.project.groupBy({
      by: ['hobbyId'],
      where: {
        isArchived: false,
        isCompleted: false,
        steps: { some: { state: 'BLOCKED' } },
      },
      _count: { _all: true },
    }),
    prisma.project.groupBy({
      by: ['hobbyId'],
      where: {
        isArchived: false,
        isCompleted: false,
        lastActivityAt: { lt: idleThreshold },
      },
      _count: { _all: true },
    }),
  ])

  const activeMap = new Map(activeCounts.map((row) => [row.hobbyId, row._count._all]))
  const blockedMap = new Map(blockedCounts.map((row) => [row.hobbyId, row._count._all]))
  const idleMap = new Map(idleCounts.map((row) => [row.hobbyId, row._count._all]))

  return hobbies.map((hobby) => ({
    id: hobby.id,
    name: hobby.name,
    color: hobby.color,
    icon: hobby.icon,
    sortOrder: hobby.sortOrder,
    createdAt: hobby.createdAt,
    updatedAt: hobby.updatedAt,
    projectCount: hobby._count.projects,
    activeCount: activeMap.get(hobby.id) ?? 0,
    blockedCount: blockedMap.get(hobby.id) ?? 0,
    idleCount: idleMap.get(hobby.id) ?? 0,
  }))
}

/** Plain hobby list, ordered by sortOrder. Used by selectors/pickers. */
export async function findAllHobbiesOrdered() {
  return prisma.hobby.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, color: true, icon: true },
  })
}

/** Returns the maximum sortOrder, or -1 when no hobbies exist. */
export async function findMaxHobbySortOrder(): Promise<number> {
  const result = await prisma.hobby.aggregate({ _max: { sortOrder: true } })
  return result._max.sortOrder ?? -1
}
