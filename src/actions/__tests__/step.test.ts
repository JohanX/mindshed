import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    step: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createStep, updateStep, deleteStep, updateStepState } from '../step'
import { prisma } from '@/lib/db'

const mockTransaction = vi.mocked(prisma.$transaction)
const mockStepUpdate = vi.mocked(prisma.step.update)
const mockStepDelete = vi.mocked(prisma.step.delete)
const mockProjectUpdate = vi.mocked(prisma.project.update)

describe('createStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectUpdate.mockResolvedValue({ hobbyId: 'h1' } as never)
  })

  it('rejects invalid projectId', async () => {
    const result = await createStep({ projectId: 'bad', name: 'Step' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
  })

  it('rejects empty name', async () => {
    const result = await createStep({ projectId: '550e8400-e29b-41d4-a716-446655440000', name: '' })
    expect(result.success).toBe(false)
  })

  it('creates step with NOT_STARTED state at end of list', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: {
          findUnique: vi.fn().mockResolvedValue({ isCompleted: false }),
        },
        step: {
          aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: 2 } }),
          create: vi.fn().mockResolvedValue({ id: 's1', projectId: 'p1' }),
        },
      }
      return fn(tx as never)
    })

    const result = await createStep({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'New Step',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('s1')
    // Verify lastActivityAt is updated
    expect(mockProjectUpdate).toHaveBeenCalled()
  })
})

describe('updateStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectUpdate.mockResolvedValue({ hobbyId: 'h1' } as never)
  })

  it('rejects invalid id', async () => {
    const result = await updateStep({ id: 'bad', name: 'Test' })
    expect(result.success).toBe(false)
  })

  it('updates step name and project lastActivityAt', async () => {
    mockStepUpdate.mockResolvedValue({ id: 's1', projectId: 'p1' } as never)

    const result = await updateStep({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Updated Name',
    })
    expect(result.success).toBe(true)
    expect(mockStepUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: 'Updated Name' },
    }))
    expect(mockProjectUpdate).toHaveBeenCalled()
  })

  it('returns error when step not found', async () => {
    mockStepUpdate.mockRejectedValue({ code: 'P2025' })

    const result = await updateStep({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })
})

describe('deleteStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectUpdate.mockResolvedValue({ hobbyId: 'h1' } as never)
  })

  it('rejects invalid id', async () => {
    const result = await deleteStep('bad')
    expect(result.success).toBe(false)
  })

  it('deletes step and updates project lastActivityAt', async () => {
    mockStepDelete.mockResolvedValue({ id: 's1', projectId: 'p1' } as never)

    const result = await deleteStep('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    expect(mockStepDelete).toHaveBeenCalled()
    expect(mockProjectUpdate).toHaveBeenCalled()
  })

  it('returns error when step not found', async () => {
    mockStepDelete.mockRejectedValue({ code: 'P2025' })

    const result = await deleteStep('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })
})

describe('updateStepState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectUpdate.mockResolvedValue({ hobbyId: 'h1' } as never)
  })

  it('rejects invalid state', async () => {
    const result = await updateStepState({ id: '550e8400-e29b-41d4-a716-446655440000', state: 'INVALID' as never })
    expect(result.success).toBe(false)
  })

  it('updates step state and project lastActivityAt', async () => {
    mockStepUpdate.mockResolvedValue({ id: 's1', projectId: 'p1' } as never)

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'IN_PROGRESS',
    })
    expect(result.success).toBe(true)
    expect(mockStepUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'IN_PROGRESS' },
    }))
    expect(mockProjectUpdate).toHaveBeenCalled()
  })

  it('returns error when step not found', async () => {
    mockStepUpdate.mockRejectedValue({ code: 'P2025' })

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'COMPLETED',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })
})
