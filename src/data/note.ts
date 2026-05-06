/**
 * Data access layer for StepNote.
 *
 * Note write flow (create) lives in `actions/note.ts` because it spans a
 * `prisma.$transaction` block (parent project is locked-check + lastActivityAt
 * bump + note insert). This module covers the read paths that exist outside
 * transactions.
 */

import { prisma } from '@/lib/db'

/** All notes for a step ordered newest-first. Story 33.2. */
export async function findStepNotes(stepId: string) {
  return prisma.stepNote.findMany({
    where: { stepId },
    orderBy: { createdAt: 'desc' },
  })
}
