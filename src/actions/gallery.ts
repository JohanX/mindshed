'use server'

import { z } from 'zod/v4'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { generateSlug, ensureUniqueSlug } from '@/lib/gallery-slug'
import type { ActionResult } from '@/lib/action-result'

function revalidateProject(hobbyId: string, projectId: string) {
  revalidatePath(`/hobbies/${hobbyId}/projects/${projectId}`)
  revalidatePath(`/hobbies/${hobbyId}`)
  revalidatePath('/')
}

function isSlugConflict(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'P2002'
}

export async function enableJourneyGallery(
  projectId: string,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = z.uuid().safeParse(projectId)
  if (!parsed.success) return { success: false, error: 'Invalid project ID' }

  try {
    const project = await prisma.$transaction(async (tx) => {
      const existing = await tx.project.findUnique({
        where: { id: parsed.data },
        select: { id: true, name: true, gallerySlug: true, hobbyId: true, isArchived: true },
      })
      if (!existing) throw new Error('PROJECT_NOT_FOUND')
      if (existing.isArchived) throw new Error('PROJECT_ARCHIVED')

      let slug = existing.gallerySlug
      if (!slug) {
        const allSlugs = await tx.project.findMany({
          where: { gallerySlug: { not: null }, id: { not: existing.id } },
          select: { gallerySlug: true },
        })
        slug = ensureUniqueSlug(
          generateSlug(existing.name),
          allSlugs.map((project) => project.gallerySlug).filter((s): s is string => s !== null),
        )
      }

      return tx.project.update({
        where: { id: parsed.data },
        data: { journeyGalleryEnabled: true, gallerySlug: slug },
        select: { id: true, gallerySlug: true, hobbyId: true },
      })
    })

    revalidateProject(project.hobbyId, project.id)
    return { success: true, data: { slug: project.gallerySlug! } }
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
      return { success: false, error: 'Project not found.' }
    }
    if (error instanceof Error && error.message === 'PROJECT_ARCHIVED') {
      return { success: false, error: 'Cannot enable gallery on an archived project.' }
    }
    if (isSlugConflict(error)) {
      return { success: false, error: 'Gallery URL conflict. Please try again.' }
    }
    console.error('enableJourneyGallery failed:', error)
    return { success: false, error: 'Failed to enable journey gallery.' }
  }
}

export async function disableJourneyGallery(projectId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(projectId)
  if (!parsed.success) return { success: false, error: 'Invalid project ID' }

  try {
    const project = await prisma.project.update({
      where: { id: parsed.data },
      data: { journeyGalleryEnabled: false },
      select: { id: true, hobbyId: true },
    })
    revalidateProject(project.hobbyId, project.id)
    return { success: true, data: null }
  } catch (error) {
    console.error('disableJourneyGallery failed:', error)
    return { success: false, error: 'Failed to disable journey gallery.' }
  }
}

export async function enableResultGallery(
  projectId: string,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = z.uuid().safeParse(projectId)
  if (!parsed.success) return { success: false, error: 'Invalid project ID' }

  try {
    const project = await prisma.$transaction(async (tx) => {
      const existing = await tx.project.findUnique({
        where: { id: parsed.data },
        select: {
          id: true,
          name: true,
          gallerySlug: true,
          hobbyId: true,
          resultStepId: true,
          isArchived: true,
          steps: {
            where: { state: 'COMPLETED' },
            orderBy: { sortOrder: 'desc' },
            take: 1,
            select: { id: true },
          },
        },
      })
      if (!existing) throw new Error('PROJECT_NOT_FOUND')
      if (existing.isArchived) throw new Error('PROJECT_ARCHIVED')

      let slug = existing.gallerySlug
      if (!slug) {
        const allSlugs = await tx.project.findMany({
          where: { gallerySlug: { not: null }, id: { not: existing.id } },
          select: { gallerySlug: true },
        })
        slug = ensureUniqueSlug(
          generateSlug(existing.name),
          allSlugs.map((project) => project.gallerySlug).filter((s): s is string => s !== null),
        )
      }

      // Re-validate resultStepId: check the step is still COMPLETED
      let resultStepId = existing.resultStepId
      if (resultStepId) {
        const resultStep = await tx.step.findUnique({
          where: { id: resultStepId },
          select: { state: true },
        })
        if (!resultStep || resultStep.state !== 'COMPLETED') {
          resultStepId = null
        }
      }
      if (!resultStepId) {
        resultStepId = existing.steps[0]?.id ?? null
      }

      return tx.project.update({
        where: { id: parsed.data },
        data: { resultGalleryEnabled: true, gallerySlug: slug, resultStepId },
        select: { id: true, gallerySlug: true, hobbyId: true },
      })
    })

    revalidateProject(project.hobbyId, project.id)
    return { success: true, data: { slug: project.gallerySlug! } }
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
      return { success: false, error: 'Project not found.' }
    }
    if (error instanceof Error && error.message === 'PROJECT_ARCHIVED') {
      return { success: false, error: 'Cannot enable gallery on an archived project.' }
    }
    if (isSlugConflict(error)) {
      return { success: false, error: 'Gallery URL conflict. Please try again.' }
    }
    console.error('enableResultGallery failed:', error)
    return { success: false, error: 'Failed to enable result gallery.' }
  }
}

export async function disableResultGallery(projectId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(projectId)
  if (!parsed.success) return { success: false, error: 'Invalid project ID' }

  try {
    const project = await prisma.project.update({
      where: { id: parsed.data },
      data: { resultGalleryEnabled: false },
      select: { id: true, hobbyId: true },
    })
    revalidateProject(project.hobbyId, project.id)
    return { success: true, data: null }
  } catch (error) {
    console.error('disableResultGallery failed:', error)
    return { success: false, error: 'Failed to disable result gallery.' }
  }
}

export async function setResultStep(
  projectId: string,
  stepId: string,
): Promise<ActionResult<null>> {
  const parsedProject = z.uuid().safeParse(projectId)
  const parsedStep = z.uuid().safeParse(stepId)
  if (!parsedProject.success || !parsedStep.success) {
    return { success: false, error: 'Invalid ID' }
  }

  try {
    const step = await prisma.step.findUnique({
      where: { id: parsedStep.data },
      select: { projectId: true, state: true },
    })
    if (!step || step.projectId !== parsedProject.data) {
      return { success: false, error: 'Step not found in this project.' }
    }
    if (step.state !== 'COMPLETED') {
      return { success: false, error: 'Only completed steps can be the result step.' }
    }

    const project = await prisma.project.update({
      where: { id: parsedProject.data },
      data: { resultStepId: parsedStep.data },
      select: { id: true, hobbyId: true },
    })
    revalidateProject(project.hobbyId, project.id)
    return { success: true, data: null }
  } catch (error) {
    console.error('setResultStep failed:', error)
    return { success: false, error: 'Failed to set result step.' }
  }
}

export async function toggleStepGalleryExclusion(stepId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(stepId)
  if (!parsed.success) return { success: false, error: 'Invalid step ID' }

  try {
    const step = await prisma.step.findUnique({
      where: { id: parsed.data },
      select: { excludeFromGallery: true, projectId: true, project: { select: { hobbyId: true } } },
    })
    if (!step) return { success: false, error: 'Step not found.' }

    await prisma.step.update({
      where: { id: parsed.data },
      data: { excludeFromGallery: !step.excludeFromGallery },
    })
    revalidateProject(step.project.hobbyId, step.projectId)
    return { success: true, data: null }
  } catch (error) {
    console.error('toggleStepGalleryExclusion failed:', error)
    return { success: false, error: 'Failed to toggle step gallery exclusion.' }
  }
}
