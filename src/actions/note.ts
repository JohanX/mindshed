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
    const { note, hobbyId, projectId } = await prisma.$transaction(async (tx) => {
      const step = await tx.step.findUnique({
        where: { id: parsed.data.stepId },
        select: { projectId: true, project: { select: { id: true, hobbyId: true } } },
      })
      if (!step) throw new Error('STEP_NOT_FOUND')

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
    if (error instanceof Error && error.message === 'STEP_NOT_FOUND') {
      return { success: false, error: 'Step not found.' }
    }
    return { success: false, error: 'Failed to add note. Please try again.' }
  }
}
