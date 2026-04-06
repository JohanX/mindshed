'use server'

import { prisma } from '@/lib/db'
import { z } from 'zod/v4'
import { createIdeaSchema, type CreateIdeaInput } from '@/lib/schemas/idea'
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
