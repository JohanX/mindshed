import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    step: {
      findUnique: vi.fn(),
    },
    stepNote: {
      create: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { addStepNote } from '../note'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const mockStepFindUnique = vi.mocked(prisma.step.findUnique)
const mockNoteCreate = vi.mocked(prisma.stepNote.create)
const mockProjectUpdate = vi.mocked(prisma.project.update)
const mockRevalidatePath = vi.mocked(revalidatePath)

const validStepId = '550e8400-e29b-41d4-a716-446655440000'

describe('addStepNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid stepId', async () => {
    const result = await addStepNote({ stepId: 'bad', text: 'A note' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
  })

  it('rejects empty text', async () => {
    const result = await addStepNote({ stepId: validStepId, text: '' })
    expect(result.success).toBe(false)
  })

  it('rejects text exceeding 2000 chars', async () => {
    const result = await addStepNote({ stepId: validStepId, text: 'a'.repeat(2001) })
    expect(result.success).toBe(false)
  })

  it('returns error when step not found', async () => {
    mockStepFindUnique.mockResolvedValue(null)

    const result = await addStepNote({ stepId: validStepId, text: 'A note' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })

  it('creates note and updates lastActivityAt on success', async () => {
    mockStepFindUnique.mockResolvedValue({
      projectId: 'p1',
      project: { hobbyId: 'h1' },
    } as never)
    mockNoteCreate.mockResolvedValue({ id: 'n1' } as never)
    mockProjectUpdate.mockResolvedValue({} as never)

    const result = await addStepNote({ stepId: validStepId, text: 'My note' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('n1')

    // Verify note was created with correct data
    expect(mockNoteCreate).toHaveBeenCalledWith({
      data: {
        stepId: validStepId,
        text: 'My note',
      },
    })

    // Verify lastActivityAt was updated
    expect(mockProjectUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { lastActivityAt: expect.any(Date) },
    })

    // Verify revalidation
    expect(mockRevalidatePath).toHaveBeenCalledWith('/hobbies/h1/projects/p1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/hobbies/h1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })

  it('returns generic error on unexpected failure', async () => {
    mockStepFindUnique.mockRejectedValue(new Error('DB connection failed'))

    const result = await addStepNote({ stepId: validStepId, text: 'A note' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Failed to add note. Please try again.')
  })

  it('trims whitespace from text before saving', async () => {
    mockStepFindUnique.mockResolvedValue({
      projectId: 'p1',
      project: { hobbyId: 'h1' },
    } as never)
    mockNoteCreate.mockResolvedValue({ id: 'n1' } as never)
    mockProjectUpdate.mockResolvedValue({} as never)

    await addStepNote({ stepId: validStepId, text: '  Trimmed note  ' })

    expect(mockNoteCreate).toHaveBeenCalledWith({
      data: {
        stepId: validStepId,
        text: 'Trimmed note',
      },
    })
  })
})
