/**
 * Data access layer for Step.
 *
 * Note: Step mutations (create/update/delete/state-change) span transactions
 * with project + step + reminder cleanup, so they live in `actions/step.ts`
 * and use `tx.*` reads inline. This module covers the read paths that exist
 * outside transactions.
 */

import { prisma } from '@/lib/db'

/** Find a single step by id with no relations. */
export async function findStepById(id: string) {
  return prisma.step.findUnique({ where: { id } })
}

/**
 * Find a step plus its project (used for ownership/completion checks).
 * Returns null when not found.
 */
export async function findStepWithProject(id: string) {
  return prisma.step.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      state: true,
      previousState: true,
      projectId: true,
      project: { select: { id: true, hobbyId: true, isCompleted: true } },
    },
  })
}

/** All steps for a project, ordered by sortOrder asc. */
export async function findStepsForProject(projectId: string) {
  return prisma.step.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  })
}

/** Returns the maximum sortOrder for steps in a project, or -1 when none. */
export async function findMaxStepSortOrder(projectId: string): Promise<number> {
  const result = await prisma.step.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  })
  return result._max.sortOrder ?? -1
}
