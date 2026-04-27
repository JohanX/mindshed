/**
 * Data access layer for Project. Pure async functions over Prisma.
 *
 * Contract (per architecture.md § "Data Access Layer"):
 *   - Returns plain values; `null` for not-found.
 *   - Throws on system errors.
 *   - Caller wraps in `ActionResult` if needed (action layer).
 *
 * `findProjectDetail` is the rich shape consumed by the project detail page.
 * `findAllProjects` and `findProjectsByHobby` produce list shapes augmented
 * with the latest-photo URL (server-resolved per architecture rule).
 */

import { prisma } from '@/lib/db'
import type { ProjectCardData } from '@/components/project/project-card'
import { deriveProjectStatus } from '@/lib/project-status'
import { fetchLatestPhotosByProject, resolveProjectThumbnailUrl } from '@/lib/project-photos'

/** Find a single project by id (no relations). */
export async function findProjectById(id: string) {
  return prisma.project.findUnique({ where: { id } })
}

/**
 * Project + everything the project detail page needs in one query:
 * hobby, ordered steps with notes/images/active blockers, BOM items with
 * inventory item hero image. Returns null when no project matches.
 *
 * The page caller is responsible for the hobbyId ownership check
 * (`project.hobbyId !== hobbyId → notFound()`).
 */
export async function findProjectDetail(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      hobby: true,
      steps: {
        orderBy: { sortOrder: 'asc' },
        include: {
          notes: { orderBy: { createdAt: 'desc' } },
          images: { orderBy: { createdAt: 'desc' } },
          blockers: { where: { isResolved: false }, orderBy: { createdAt: 'desc' } },
        },
      },
      bomItems: {
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
                select: { type: true, storageKey: true, url: true },
              },
            },
          },
        },
      },
    },
  })
}

export type ProjectWithHobby = ProjectCardData & {
  hobby: { name: string; color: string; icon: string | null }
}

/** Active (non-archived, non-completed) projects across all hobbies. */
export async function findAllActiveProjects(): Promise<ProjectWithHobby[]> {
  const projects = await prisma.project.findMany({
    where: { isArchived: false, isCompleted: false },
    orderBy: { lastActivityAt: 'desc' },
    include: {
      hobby: { select: { name: true, color: true, icon: true } },
      steps: { orderBy: { sortOrder: 'asc' } },
    },
  })

  const latestPhotoByProject = await fetchLatestPhotosByProject(projects.map((p) => p.id))

  return projects.map((project) => {
    const currentStep =
      project.steps.find((step) => step.state === 'IN_PROGRESS') ??
      project.steps.find((step) => step.state === 'NOT_STARTED')
    return {
      id: project.id,
      name: project.name,
      hobbyId: project.hobbyId,
      totalSteps: project.steps.length,
      completedSteps: project.steps.filter((step) => step.state === 'COMPLETED').length,
      derivedStatus: deriveProjectStatus(project.steps),
      currentStepName: currentStep?.name ?? null,
      latestPhotoUrl: resolveProjectThumbnailUrl(latestPhotoByProject.get(project.id) ?? null),
      hobby: project.hobby,
    }
  })
}

export interface ProjectWithProgress extends ProjectCardData {
  isArchived: boolean
  isCompleted: boolean
}

/** All projects (any state) for a single hobby, ordered by lastActivityAt desc. */
export async function findProjectsByHobby(hobbyId: string): Promise<ProjectWithProgress[]> {
  const projects = await prisma.project.findMany({
    where: { hobbyId },
    orderBy: { lastActivityAt: 'desc' },
    include: {
      steps: {
        select: { id: true, name: true, state: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  const latestPhotoByProject = await fetchLatestPhotosByProject(projects.map((p) => p.id))

  return projects.map((project) => {
    const currentStep =
      project.steps.find((step) => step.state === 'IN_PROGRESS') ??
      project.steps.find((step) => step.state === 'NOT_STARTED')
    return {
      id: project.id,
      name: project.name,
      hobbyId: project.hobbyId,
      totalSteps: project.steps.length,
      completedSteps: project.steps.filter((step) => step.state === 'COMPLETED').length,
      derivedStatus: deriveProjectStatus(project.steps),
      currentStepName: currentStep?.name ?? null,
      latestPhotoUrl: resolveProjectThumbnailUrl(latestPhotoByProject.get(project.id) ?? null),
      isArchived: project.isArchived,
      isCompleted: project.isCompleted,
    }
  })
}

export interface IdleProjectData extends ProjectCardData {
  hobby: { name: string; color: string; icon: string | null }
  lastActivityAt: Date // Needed for idle duration display
}

/**
 * Active projects with `lastActivityAt < threshold` — the dashboard's idle
 * projects section. Caller passes the threshold so this function stays
 * settings-agnostic.
 */
export async function findIdleProjects(threshold: Date): Promise<IdleProjectData[]> {
  const projects = await prisma.project.findMany({
    where: {
      isArchived: false,
      isCompleted: false,
      lastActivityAt: { lt: threshold },
    },
    orderBy: { lastActivityAt: 'asc' },
    include: {
      hobby: { select: { name: true, color: true, icon: true } },
      steps: { orderBy: { sortOrder: 'asc' } },
    },
  })

  return projects.map((project) => {
    const currentStep =
      project.steps.find((step) => step.state === 'IN_PROGRESS') ??
      project.steps.find((step) => step.state === 'NOT_STARTED')
    return {
      id: project.id,
      name: project.name,
      hobbyId: project.hobbyId,
      totalSteps: project.steps.length,
      completedSteps: project.steps.filter((step) => step.state === 'COMPLETED').length,
      derivedStatus: deriveProjectStatus(project.steps),
      currentStepName: currentStep?.name ?? null,
      hobby: project.hobby,
      lastActivityAt: project.lastActivityAt,
    }
  })
}

/** Returns the maximum sortOrder for projects in a hobby, or -1 when none. */
export async function findMaxProjectSortOrder(hobbyId: string): Promise<number> {
  const result = await prisma.project.aggregate({
    where: { hobbyId },
    _max: { sortOrder: true },
  })
  return result._max.sortOrder ?? -1
}
