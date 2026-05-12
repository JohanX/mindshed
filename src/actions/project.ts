'use server'

import { prisma } from '@/lib/db'
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@/lib/schemas/project'
import { z } from 'zod/v4'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import { cleanupStorageKeys } from '@/lib/storage-cleanup'
import { getIdleThresholdDays } from '@/data/settings'
import { nextCloneName } from '@/lib/project-clone'
import {
  findAllActiveProjects,
  findProjectsByHobby as findProjectsByHobbyData,
  findIdleProjects,
  type ProjectWithHobby,
  type ProjectWithProgress,
  type IdleProjectData,
} from '@/data/project'

// Re-export types so existing callers (`import type { ProjectWithHobby } from '@/actions/project'`)
// continue to work after the data-layer migration. New callers should import
// from '@/data/project' directly.
export type { ProjectWithHobby, ProjectWithProgress, IdleProjectData } from '@/data/project'

export async function createProject(
  input: CreateProjectInput,
): Promise<ActionResult<{ id: string; hobbyId: string }>> {
  const parsed = createProjectSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { name, description, hobbyId, steps } = parsed.data

  try {
    const project = await prisma.$transaction(async (tx) => {
      // Verify hobby exists inside transaction
      const hobby = await tx.hobby.findUnique({ where: { id: hobbyId } })
      if (!hobby) throw new Error('HOBBY_NOT_FOUND')

      const maxSort = await tx.project.aggregate({
        where: { hobbyId },
        _max: { sortOrder: true },
      })

      return tx.project.create({
        data: {
          name,
          description: description ?? null,
          hobbyId,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
          lastActivityAt: new Date(),
          steps: {
            create: steps.map((step, index) => ({
              name: step.name,
              state: 'NOT_STARTED' as const,
              sortOrder: index,
            })),
          },
        },
      })
    })

    revalidatePath(`/hobbies/${hobbyId}`)
    revalidatePath('/')
    return { success: true, data: { id: project.id, hobbyId } }
  } catch (error: unknown) {
    console.error('createProject failed:', error)
    if (error instanceof Error && error.message === 'HOBBY_NOT_FOUND') {
      return { success: false, error: 'Hobby not found' }
    }
    return { success: false, error: 'Failed to create project. Please try again.' }
  }
}

export async function getAllProjects(): Promise<ActionResult<ProjectWithHobby[]>> {
  try {
    const data = await findAllActiveProjects()
    return { success: true, data }
  } catch (error) {
    console.error('getAllProjects failed:', error)
    return { success: false, error: 'Failed to load projects.' }
  }
}

export async function getProjectsByHobby(
  hobbyId: string,
): Promise<ActionResult<ProjectWithProgress[]>> {
  const parsed = z.uuid().safeParse(hobbyId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid hobby ID' }
  }

  try {
    const data = await findProjectsByHobbyData(parsed.data)
    return { success: true, data }
  } catch (error) {
    console.error('getProjectsByHobby failed:', error)
    return { success: false, error: 'Failed to load projects.' }
  }
}

export async function updateProject(
  input: UpdateProjectInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateProjectSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const project = await prisma.project.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        lastActivityAt: new Date(),
      },
    })

    revalidatePath(`/hobbies/${project.hobbyId}/projects/${project.id}`)
    revalidatePath(`/hobbies/${project.hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')
    return { success: true, data: { id: project.id } }
  } catch (error: unknown) {
    console.error('updateProject failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Project not found.' }
    }
    return { success: false, error: 'Failed to update project. Please try again.' }
  }
}

export async function cloneProject(
  id: string,
): Promise<ActionResult<{ id: string; hobbyId: string }>> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) {
    return { success: false, error: 'Invalid project ID.' }
  }

  try {
    const clone = await prisma.$transaction(async (tx) => {
      const source = await tx.project.findUnique({
        where: { id: parsed.data },
        include: {
          steps: { orderBy: { sortOrder: 'asc' } },
          bomItems: { orderBy: { sortOrder: 'asc' } },
        },
      })
      if (!source) throw new Error('PROJECT_NOT_FOUND')

      const siblings = await tx.project.findMany({
        where: { hobbyId: source.hobbyId, name: { startsWith: source.name } },
        select: { name: true },
      })
      const cloneName = nextCloneName(
        source.name,
        siblings.map((project) => project.name),
      )

      const maxSort = await tx.project.aggregate({
        where: { hobbyId: source.hobbyId },
        _max: { sortOrder: true },
      })
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1

      const created = await tx.project.create({
        data: {
          name: cloneName,
          description: source.description,
          hobbyId: source.hobbyId,
          sortOrder,
          lastActivityAt: new Date(),
          steps: {
            create: source.steps.map((step) => ({
              name: step.name,
              sortOrder: step.sortOrder,
              state: 'NOT_STARTED' as const,
              previousState: null,
              excludeFromGallery: false,
            })),
          },
          bomItems: {
            create: source.bomItems.map((bomItem) => ({
              inventoryItemId: bomItem.inventoryItemId,
              label: bomItem.label,
              requiredQuantity: bomItem.requiredQuantity,
              unit: bomItem.unit,
              sortOrder: bomItem.sortOrder,
              consumptionState: 'NOT_CONSUMED' as const,
            })),
          },
        },
      })

      return created
    })

    revalidatePath(`/hobbies/${clone.hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')
    return { success: true, data: { id: clone.id, hobbyId: clone.hobbyId } }
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
      return { success: false, error: 'Project not found.' }
    }
    console.error('cloneProject failed:', error)
    return { success: false, error: 'Clone failed — try again' }
  }
}

export async function deleteProject(id: string): Promise<ActionResult<{ hobbyId: string }>> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) {
    return { success: false, error: 'Invalid project ID' }
  }

  try {
    const { project, storageKeyRows } = await prisma.$transaction(async (tx) => {
      const steps = await tx.step.findMany({
        where: { projectId: parsed.data },
        select: { id: true },
      })
      const targetIds = [parsed.data, ...steps.map((step) => step.id)]
      await tx.reminder.deleteMany({ where: { targetId: { in: targetIds } } })
      // FR122 / Story 28.1: collect step_image storage keys for every
      // step in this project BEFORE the cascade so they're captured
      // atomically with the parent delete.
      // Story 35.1 / Epic 35: select mediaType so the cleanup helper can
      // route resource_type:'video' to Cloudinary's destroy() for video rows.
      const storageKeyRows =
        steps.length > 0
          ? await tx.stepImage.findMany({
              where: {
                stepId: { in: steps.map((step) => step.id) },
                type: 'UPLOAD',
                storageKey: { not: null },
              },
              select: { storageKey: true, mediaType: true },
            })
          : []
      const project = await tx.project.delete({ where: { id: parsed.data } })
      return { project, storageKeyRows }
    })

    // Best-effort post-commit storage cleanup. Failures NEVER fail the
    // action — see FR122 best-effort guarantee.
    await cleanupStorageKeys(
      storageKeyRows.map(({ storageKey, mediaType }) => ({
        storageKey,
        mediaType: mediaType === 'VIDEO' ? 'video' : 'image',
      })),
    )

    revalidatePath(`/hobbies/${project.hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')
    return { success: true, data: { hobbyId: project.hobbyId } }
  } catch (error: unknown) {
    console.error('deleteProject failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Project not found.' }
    }
    return { success: false, error: 'Failed to delete project. Please try again.' }
  }
}

export async function archiveProject(id: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) {
    return { success: false, error: 'Invalid project ID' }
  }

  try {
    const project = await prisma.project.update({
      where: { id: parsed.data },
      data: { isArchived: true },
    })

    revalidatePath(`/hobbies/${project.hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('archiveProject failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Project not found.' }
    }
    return { success: false, error: 'Failed to archive project.' }
  }
}

// Story 30.3 / FR127: project.isCompleted is now a user-driven flag — set
// explicitly via the confirmation dialog after the last step completes
// (`step-card-list.tsx`) or via the project meatball menu (`project-actions.tsx`).
// The auto-toggle previously in `updateStepState` (step.ts) was removed.
export async function completeProject(id: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) {
    return { success: false, error: 'Invalid project ID' }
  }

  try {
    const project = await prisma.project.update({
      where: { id: parsed.data },
      data: { isCompleted: true, lastActivityAt: new Date() },
    })

    revalidatePath(`/hobbies/${project.hobbyId}/projects/${project.id}`)
    revalidatePath(`/hobbies/${project.hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('completeProject failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Project not found.' }
    }
    return { success: false, error: 'Failed to complete project.' }
  }
}

export async function uncompleteProject(id: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) {
    return { success: false, error: 'Invalid project ID' }
  }

  try {
    const project = await prisma.project.update({
      where: { id: parsed.data },
      data: { isCompleted: false, lastActivityAt: new Date() },
    })

    revalidatePath(`/hobbies/${project.hobbyId}/projects/${project.id}`)
    revalidatePath(`/hobbies/${project.hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('uncompleteProject failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Project not found.' }
    }
    return { success: false, error: 'Failed to unlock project.' }
  }
}

export async function getIdleProjects(): Promise<ActionResult<IdleProjectData[]>> {
  try {
    const threshold = new Date()
    threshold.setDate(threshold.getDate() - (await getIdleThresholdDays()))
    const data = await findIdleProjects(threshold)
    return { success: true, data }
  } catch (error) {
    console.error('getIdleProjects failed:', error)
    return { success: false, error: 'Failed to load idle projects.' }
  }
}
