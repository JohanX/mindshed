'use server'

import { z } from 'zod/v4'
import { prisma } from '@/lib/db'
import {
  createNoteSchema,
  type CreateNoteInput,
  updateNoteSchema,
  type UpdateNoteInput,
} from '@/lib/schemas/note'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import type { StepNote } from '@/generated/prisma/client'

export async function addStepNote(input: CreateNoteInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createNoteSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const { note, hobbyId, projectId } = await prisma.$transaction(async (tx) => {
      const step = await tx.step.findUnique({
        where: { id: parsed.data.stepId },
        select: {
          projectId: true,
          project: { select: { id: true, hobbyId: true, isCompleted: true } },
        },
      })
      if (!step) throw new Error('STEP_NOT_FOUND')
      if (step.project.isCompleted) throw new Error('PROJECT_COMPLETED')

      const created = await tx.stepNote.create({
        data: { stepId: parsed.data.stepId, text: parsed.data.text },
      })

      await tx.project.update({
        where: { id: step.projectId },
        data: { lastActivityAt: new Date() },
      })

      return { note: created, hobbyId: step.project.hobbyId, projectId: step.projectId }
    })

    revalidatePath(`/hobbies/${hobbyId}/projects/${projectId}`)
    revalidatePath(`/hobbies/${hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')

    return { success: true, data: { id: note.id } }
  } catch (error) {
    console.error('addStepNote failed:', error)
    if (error instanceof Error) {
      if (error.message === 'STEP_NOT_FOUND') return { success: false, error: 'Step not found.' }
      if (error.message === 'PROJECT_COMPLETED')
        return { success: false, error: 'Cannot modify notes on a completed project.' }
    }
    return { success: false, error: 'Failed to add note. Please try again.' }
  }
}

export async function getStepNotes(stepId: string): Promise<ActionResult<StepNote[]>> {
  const parsed = z.uuid().safeParse(stepId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid step ID.' }
  }

  try {
    const notes = await prisma.stepNote.findMany({
      where: { stepId: parsed.data },
      orderBy: { createdAt: 'desc' },
    })

    return { success: true, data: notes }
  } catch (error) {
    console.error('getStepNotes failed:', error)
    return { success: false, error: 'Failed to load notes. Please try again.' }
  }
}

export async function updateStepNote(
  input: UpdateNoteInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateNoteSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const { note, hobbyId, projectId } = await prisma.$transaction(async (tx) => {
      const existing = await tx.stepNote.findUnique({
        where: { id: parsed.data.id },
        select: {
          step: {
            select: { projectId: true, project: { select: { hobbyId: true, isCompleted: true } } },
          },
        },
      })
      if (!existing) throw new Error('NOTE_NOT_FOUND')
      if (existing.step.project.isCompleted) throw new Error('PROJECT_COMPLETED')

      const updated = await tx.stepNote.update({
        where: { id: parsed.data.id },
        data: { text: parsed.data.text },
      })

      await tx.project.update({
        where: { id: existing.step.projectId },
        data: { lastActivityAt: new Date() },
      })

      return {
        note: updated,
        hobbyId: existing.step.project.hobbyId,
        projectId: existing.step.projectId,
      }
    })

    revalidatePath(`/hobbies/${hobbyId}/projects/${projectId}`)
    revalidatePath('/')

    return { success: true, data: { id: note.id } }
  } catch (error) {
    console.error('updateStepNote failed:', error)
    if (error instanceof Error) {
      if (error.message === 'NOTE_NOT_FOUND') return { success: false, error: 'Note not found.' }
      if (error.message === 'PROJECT_COMPLETED')
        return { success: false, error: 'Cannot modify notes on a completed project.' }
    }
    return { success: false, error: 'Failed to update note.' }
  }
}

export async function deleteStepNote(noteId: string): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(noteId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid note ID.' }
  }

  try {
    const { hobbyId, projectId } = await prisma.$transaction(async (tx) => {
      const note = await tx.stepNote.findUnique({
        where: { id: parsed.data },
        select: {
          step: {
            select: { projectId: true, project: { select: { hobbyId: true, isCompleted: true } } },
          },
        },
      })
      if (!note) throw new Error('NOTE_NOT_FOUND')
      if (note.step.project.isCompleted) throw new Error('PROJECT_COMPLETED')

      await tx.stepNote.delete({ where: { id: parsed.data } })

      await tx.project.update({
        where: { id: note.step.projectId },
        data: { lastActivityAt: new Date() },
      })

      return { hobbyId: note.step.project.hobbyId, projectId: note.step.projectId }
    })

    revalidatePath(`/hobbies/${hobbyId}/projects/${projectId}`)
    revalidatePath('/')

    return { success: true, data: null }
  } catch (error) {
    console.error('deleteStepNote failed:', error)
    if (error instanceof Error) {
      if (error.message === 'NOTE_NOT_FOUND') return { success: false, error: 'Note not found.' }
      if (error.message === 'PROJECT_COMPLETED')
        return { success: false, error: 'Cannot modify notes on a completed project.' }
    }
    return { success: false, error: 'Failed to delete note.' }
  }
}
