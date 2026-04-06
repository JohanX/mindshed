import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { addStepNote } from '../note'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const mockTransaction = vi.mocked(prisma.$transaction)
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
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: { findUnique: vi.fn().mockResolvedValue(null) },
        stepNote: { create: vi.fn() },
        project: { update: vi.fn() },
      }
      return fn(tx as never)
    })

    const result = await addStepNote({ stepId: validStepId, text: 'A note' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })

  it('creates note and updates lastActivityAt on success', async () => {
    const mockNoteCreate = vi.fn().mockResolvedValue({ id: 'n1' })
    const mockProjectUpdate = vi.fn().mockResolvedValue({})

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUnique: vi.fn().mockResolvedValue({
            projectId: 'p1',
            project: { id: 'p1', hobbyId: 'h1' },
          }),
        },
        stepNote: { create: mockNoteCreate },
        project: { update: mockProjectUpdate },
      }
      return fn(tx as never)
    })

    const result = await addStepNote({ stepId: validStepId, text: 'My note' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('n1')

    expect(mockNoteCreate).toHaveBeenCalledWith({
      data: { stepId: validStepId, text: 'My note' },
    })

    expect(mockProjectUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { lastActivityAt: expect.any(Date) },
    })

    expect(mockRevalidatePath).toHaveBeenCalledWith('/hobbies/h1/projects/p1')
  })

  it('returns generic error on unexpected failure', async () => {
    mockTransaction.mockRejectedValue(new Error('DB connection failed'))

    const result = await addStepNote({ stepId: validStepId, text: 'A note' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Failed to add note. Please try again.')
  })

  it('trims whitespace from text before saving', async () => {
    const mockNoteCreate = vi.fn().mockResolvedValue({ id: 'n1' })

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUnique: vi.fn().mockResolvedValue({
            projectId: 'p1',
            project: { id: 'p1', hobbyId: 'h1' },
          }),
        },
        stepNote: { create: mockNoteCreate },
        project: { update: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx as never)
    })

    await addStepNote({ stepId: validStepId, text: '  Trimmed note  ' })

    expect(mockNoteCreate).toHaveBeenCalledWith({
      data: { stepId: validStepId, text: 'Trimmed note' },
    })
  })
})
