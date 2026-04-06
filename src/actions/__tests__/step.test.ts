import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    step: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
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

import { createStep, updateStep, deleteStep, updateStepState, reorderSteps } from '../step'
import { prisma } from '@/lib/db'

const mockTransaction = vi.mocked(prisma.$transaction)
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
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({ project: { isCompleted: false } }),
          update: vi.fn().mockResolvedValue({ id: 's1', projectId: 'p1' }),
        },
      }
      return fn(tx as never)
    })

    const result = await updateStep({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Updated Name',
    })
    expect(result.success).toBe(true)
    expect(mockProjectUpdate).toHaveBeenCalled()
  })

  it('returns error when step not found', async () => {
    mockTransaction.mockRejectedValue({ code: 'P2025' })

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
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({ projectId: 'p1', project: { isCompleted: false } }),
          delete: vi.fn().mockResolvedValue({ id: 's1', projectId: 'p1' }),
        },
      }
      return fn(tx as never)
    })

    const result = await deleteStep('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    expect(mockProjectUpdate).toHaveBeenCalled()
  })

  it('returns error when step not found', async () => {
    mockTransaction.mockRejectedValue({ code: 'P2025' })

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
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({ project: { isCompleted: false } }),
          update: vi.fn().mockResolvedValue({ id: 's1', projectId: 'p1' }),
        },
      }
      return fn(tx as never)
    })

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'IN_PROGRESS',
    })
    expect(result.success).toBe(true)
    expect(mockProjectUpdate).toHaveBeenCalled()
  })

  it('returns error when step not found', async () => {
    mockTransaction.mockRejectedValue({ code: 'P2025' })

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'COMPLETED',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })
})

describe('reorderSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectUpdate.mockResolvedValue({ hobbyId: 'h1' } as never)
  })

  const projectId = '550e8400-e29b-41d4-a716-446655440000'
  const stepId1 = '660e8400-e29b-41d4-a716-446655440001'
  const stepId2 = '660e8400-e29b-41d4-a716-446655440002'
  const stepId3 = '660e8400-e29b-41d4-a716-446655440003'

  it('rejects invalid projectId', async () => {
    const result = await reorderSteps({ projectId: 'bad', orderedStepIds: [stepId1] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
  })

  it('rejects duplicate step IDs', async () => {
    const result = await reorderSteps({ projectId, orderedStepIds: [stepId1, stepId1] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Duplicate')
  })

  it('rejects empty orderedStepIds', async () => {
    const result = await reorderSteps({ projectId, orderedStepIds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects when project is completed', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: {
          findUnique: vi.fn().mockResolvedValue({ isCompleted: true }),
          update: vi.fn(),
        },
        step: {
          findMany: vi.fn(),
          update: vi.fn(),
        },
      }
      return fn(tx as never)
    })

    const result = await reorderSteps({ projectId, orderedStepIds: [stepId1, stepId2] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('completed')
  })

  it('rejects when project not found', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
        step: {
          findMany: vi.fn(),
          update: vi.fn(),
        },
      }
      return fn(tx as never)
    })

    const result = await reorderSteps({ projectId, orderedStepIds: [stepId1] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('not found')
  })

  it('rejects when step does not belong to project', async () => {
    const foreignStepId = '770e8400-e29b-41d4-a716-446655440099'
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: {
          findUnique: vi.fn().mockResolvedValue({ isCompleted: false }),
          update: vi.fn(),
        },
        step: {
          findMany: vi.fn().mockResolvedValue([{ id: stepId1 }, { id: stepId2 }]),
          update: vi.fn(),
        },
      }
      return fn(tx as never)
    })

    const result = await reorderSteps({ projectId, orderedStepIds: [stepId1, foreignStepId] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('do not belong')
  })

  it('updates sort orders and project lastActivityAt on success', async () => {
    const mockStepUpdateTx = vi.fn().mockResolvedValue({})
    const mockProjectUpdateTx = vi.fn().mockResolvedValue({})

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: {
          findUnique: vi.fn().mockResolvedValue({ isCompleted: false }),
          update: mockProjectUpdateTx,
        },
        step: {
          findMany: vi.fn().mockResolvedValue([{ id: stepId1 }, { id: stepId2 }, { id: stepId3 }]),
          update: mockStepUpdateTx,
        },
      }
      return fn(tx as never)
    })

    const result = await reorderSteps({ projectId, orderedStepIds: [stepId3, stepId1, stepId2] })
    expect(result.success).toBe(true)

    // Should have updated each step's sortOrder
    expect(mockStepUpdateTx).toHaveBeenCalledTimes(3)
    expect(mockStepUpdateTx).toHaveBeenCalledWith({ where: { id: stepId3 }, data: { sortOrder: 0 } })
    expect(mockStepUpdateTx).toHaveBeenCalledWith({ where: { id: stepId1 }, data: { sortOrder: 1 } })
    expect(mockStepUpdateTx).toHaveBeenCalledWith({ where: { id: stepId2 }, data: { sortOrder: 2 } })

    // Should call updateProjectActivity (revalidatePath + lastActivityAt)
    expect(mockProjectUpdate).toHaveBeenCalled()
  })
})
