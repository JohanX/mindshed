'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import { createIdeaSchema, type CreateIdeaInput, updateIdeaSchema, type UpdateIdeaInput } from '@/lib/schemas/idea'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import type { Idea } from '@/generated/prisma/client'

export async function createIdea(input: CreateIdeaInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createIdeaSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const hobby = await prisma.hobby.findUnique({
      where: { id: parsed.data.hobbyId },
      select: { id: true },
    })

    if (!hobby) {
      return { success: false, error: 'Hobby not found.' }
    }

    const idea = await prisma.idea.create({
      data: {
        hobbyId: parsed.data.hobbyId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        referenceLink: parsed.data.referenceLink ?? null,
      },
    })

    revalidatePath(`/hobbies/${parsed.data.hobbyId}/ideas`)
    revalidatePath('/ideas')
    return { success: true, data: { id: idea.id } }
  } catch (error) {
    console.error('createIdea failed:', error)
    return { success: false, error: 'Failed to create idea. Please try again.' }
  }
}

export async function getIdeasByHobby(hobbyId: string): Promise<ActionResult<Idea[]>> {
  const parsed = z.uuid().safeParse(hobbyId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid hobby ID' }
  }

  try {
    const ideas = await prisma.idea.findMany({
      where: { hobbyId: parsed.data },
      orderBy: [{ isPromoted: 'asc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: ideas }
  } catch (error) {
    console.error('getIdeasByHobby failed:', error)
    return { success: false, error: 'Failed to load ideas.' }
  }
}

export type IdeaWithHobby = Idea & { hobby: { id: string; name: string; color: string } }

export async function getAllIdeas(): Promise<ActionResult<IdeaWithHobby[]>> {
  try {
    const ideas = await prisma.idea.findMany({
      orderBy: { createdAt: 'desc' },
      include: { hobby: { select: { id: true, name: true, color: true } } },
    })
    return { success: true, data: ideas }
  } catch (error) {
    console.error('getAllIdeas failed:', error)
    return { success: false as const, error: 'Failed to load ideas.' }
  }
}

export async function promoteIdea(ideaId: string): Promise<ActionResult<{ projectId: string }>> {
  const parsed = z.uuid().safeParse(ideaId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid idea ID.' }
  }

  try {
    const idea = await prisma.idea.findUnique({
      where: { id: parsed.data },
      select: { id: true, title: true, description: true, hobbyId: true, isPromoted: true },
    })
    if (!idea) return { success: false, error: 'Idea not found.' }
    if (idea.isPromoted) return { success: false, error: 'Idea already promoted.' }

    const project = await prisma.project.create({
      data: {
        name: idea.title,
        description: idea.description,
        hobbyId: idea.hobbyId,
        lastActivityAt: new Date(),
      },
    })

    await prisma.idea.update({
      where: { id: parsed.data },
      data: { isPromoted: true },
    })

    revalidatePath(`/hobbies/${idea.hobbyId}/ideas`)
    revalidatePath(`/hobbies/${idea.hobbyId}`)
    revalidatePath('/ideas')
    revalidatePath('/projects')

    return { success: true, data: { projectId: project.id } }
  } catch (error) {
    console.error('promoteIdea failed:', error)
    return { success: false, error: 'Failed to promote idea.' }
  }
}

export async function updateIdea(input: UpdateIdeaInput): Promise<ActionResult<{ id: string }>> {
  const parsed = updateIdeaSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const idea = await prisma.idea.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        referenceLink: parsed.data.referenceLink ?? null,
      },
    })

    revalidatePath(`/hobbies/${idea.hobbyId}/ideas`)
    revalidatePath('/ideas')

    return { success: true, data: { id: idea.id } }
  } catch (error) {
    console.error('updateIdea failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Idea not found.' }
    }
    return { success: false, error: 'Failed to update idea.' }
  }
}

export async function deleteIdea(ideaId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(ideaId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid idea ID.' }
  }

  try {
    const idea = await prisma.idea.delete({
      where: { id: parsed.data },
    })

    revalidatePath(`/hobbies/${idea.hobbyId}/ideas`)
    revalidatePath('/ideas')

    return { success: true, data: null }
  } catch (error) {
    console.error('deleteIdea failed:', error)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return { success: false, error: 'Idea not found.' }
    }
    return { success: false, error: 'Failed to delete idea.' }
  }
}
