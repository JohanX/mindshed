'use server'

import { prisma } from '@/lib/db'
import { createProjectSchema, updateProjectSchema, type CreateProjectInput, type UpdateProjectInput } from '@/lib/schemas/project'
import { z } from 'zod/v4'
import type { ProjectCardData } from '@/components/project/project-card'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import { IDLE_THRESHOLD_DAYS } from '@/lib/constants'
import { getCurrentStep } from '@/lib/project-utils'
import { deriveProjectStatus } from '@/lib/project-status'

export async function createProject(input: CreateProjectInput): Promise<ActionResult<{ id: string; hobbyId: string }>> {
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

export type ProjectWithHobby = ProjectCardData & {
  hobby: { name: string; color: string; icon: string | null }
}

export async function getAllProjects(): Promise<ActionResult<ProjectWithHobby[]>> {
  try {
    const projects = await prisma.project.findMany({
      where: { isArchived: false, isCompleted: false },
      orderBy: { lastActivityAt: 'desc' },
      include: {
        hobby: { select: { name: true, color: true, icon: true } },
        steps: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return {
      success: true,
      data: projects.map((p) => {
        const currentStep = p.steps.find(s => s.state === 'IN_PROGRESS') ??
          p.steps.find(s => s.state === 'NOT_STARTED')
        return {
          id: p.id,
          name: p.name,
          hobbyId: p.hobbyId,
          totalSteps: p.steps.length,
          completedSteps: p.steps.filter(s => s.state === 'COMPLETED').length,
          derivedStatus: deriveProjectStatus(p.steps),
          currentStepName: currentStep?.name ?? null,
          hobby: p.hobby,
        }
      }),
    }
  } catch (error) {
    console.error('getAllProjects failed:', error)
    return { success: false, error: 'Failed to load projects.' }
  }
}

export interface ProjectWithProgress extends ProjectCardData {
  isArchived: boolean
  isCompleted: boolean // DB field kept for query optimization
}

export async function getProjectsByHobby(hobbyId: string): Promise<ActionResult<ProjectWithProgress[]>> {
  const parsed = z.uuid().safeParse(hobbyId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid hobby ID' }
  }

  try {
    const projects = await prisma.project.findMany({
      where: { hobbyId: parsed.data },
      orderBy: { lastActivityAt: 'desc' },
      include: {
        steps: {
          select: { id: true, name: true, state: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    return {
      success: true,
      data: projects.map((p) => {
        const currentStep = p.steps.find(s => s.state === 'IN_PROGRESS') ??
          p.steps.find(s => s.state === 'NOT_STARTED')
        return {
          id: p.id,
          name: p.name,
          hobbyId: p.hobbyId,
          totalSteps: p.steps.length,
          completedSteps: p.steps.filter(s => s.state === 'COMPLETED').length,
          derivedStatus: deriveProjectStatus(p.steps),
          currentStepName: currentStep?.name ?? null,
          isArchived: p.isArchived,
          isCompleted: p.isCompleted,
        }
      }),
    }
  } catch (error) {
    console.error('getProjectsByHobby failed:', error)
    return { success: false, error: 'Failed to load projects.' }
  }
}

export async function updateProject(input: UpdateProjectInput): Promise<ActionResult<{ id: string }>> {
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

export async function deleteProject(id: string): Promise<ActionResult<{ hobbyId: string }>> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) {
    return { success: false, error: 'Invalid project ID' }
  }

  try {
    const project = await prisma.project.delete({
      where: { id: parsed.data },
    })

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

// @deprecated - project completion is now auto-derived from step states (Story 9.3)
export async function completeProject(id: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) {
    return { success: false, error: 'Invalid project ID' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: parsed.data },
        include: { steps: true },
      })
      if (!project) throw new Error('PROJECT_NOT_FOUND')

      const allCompleted = project.steps.every(s => s.state === 'COMPLETED')
      if (!allCompleted) throw new Error('STEPS_NOT_COMPLETED')

      await tx.project.update({
        where: { id: parsed.data },
        data: { isCompleted: true },
      })
    })

    // Get hobbyId for revalidation
    const project = await prisma.project.findUnique({ where: { id: parsed.data }, select: { hobbyId: true } })
    if (project) {
      revalidatePath(`/hobbies/${project.hobbyId}`)
    }
    revalidatePath('/projects')
    revalidatePath('/')
    return { success: true, data: null }
  } catch (error: unknown) {
    console.error('completeProject failed:', error)
    if (error instanceof Error) {
      if (error.message === 'PROJECT_NOT_FOUND') return { success: false, error: 'Project not found.' }
      if (error.message === 'STEPS_NOT_COMPLETED') return { success: false, error: 'All steps must be completed first.' }
    }
    return { success: false, error: 'Failed to complete project.' }
  }
}

export interface IdleProjectData extends ProjectCardData {
  hobby: { name: string; color: string; icon: string | null }
  lastActivityAt: Date // Needed for idle duration display
}

export async function getIdleProjects(): Promise<ActionResult<IdleProjectData[]>> {
  try {
    const threshold = new Date()
    threshold.setDate(threshold.getDate() - IDLE_THRESHOLD_DAYS)

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

    return {
      success: true,
      data: projects.map((p) => {
        const currentStep = getCurrentStep(p.steps)
        return {
          id: p.id,
          name: p.name,
          hobbyId: p.hobbyId,
          totalSteps: p.steps.length,
          completedSteps: p.steps.filter(s => s.state === 'COMPLETED').length,
          derivedStatus: deriveProjectStatus(p.steps),
          currentStepName: currentStep?.name ?? null,
          hobby: p.hobby,
          lastActivityAt: p.lastActivityAt,
        }
      }),
    }
  } catch (error) {
    console.error('getIdleProjects failed:', error)
    return { success: false, error: 'Failed to load idle projects.' }
  }
}
