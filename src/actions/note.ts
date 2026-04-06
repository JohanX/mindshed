'use server'

import { prisma } from '@/lib/db'
import { createNoteSchema, type CreateNoteInput } from '@/lib/schemas/note'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'

export async function addStepNote(input: CreateNoteInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createNoteSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  try {
    const step = await prisma.step.findUnique({
      where: { id: parsed.data.stepId },
      select: { projectId: true, project: { select: { hobbyId: true } } },
    })

    if (!step) {
      return { success: false, error: 'Step not found.' }
    }

    const note = await prisma.stepNote.create({
      data: {
        stepId: parsed.data.stepId,
        text: parsed.data.text,
      },
    })

    await prisma.project.update({
      where: { id: step.projectId },
      data: { lastActivityAt: new Date() },
    })

    revalidatePath(`/hobbies/${step.project.hobbyId}/projects/${step.projectId}`)
    revalidatePath(`/hobbies/${step.project.hobbyId}`)
    revalidatePath('/projects')
    revalidatePath('/')

    return { success: true, data: { id: note.id } }
  } catch (error) {
    console.error('addStepNote failed:', error)
    return { success: false, error: 'Failed to add note. Please try again.' }
  }
}
