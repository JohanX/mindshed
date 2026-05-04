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

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(),
}))

import {
  createStep,
  updateStep,
  deleteStep,
  updateStepState,
  reorderSteps,
  setStepHours,
} from '../step'
import { prisma } from '@/lib/db'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'

const mockTransaction = vi.mocked(prisma.$transaction)
const mockProjectUpdate = vi.mocked(prisma.project.update)
const mockGetAdapter = vi.mocked(getImageStorageAdapter)

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

  it('deletes step, cleans up reminders, and updates project lastActivityAt', async () => {
    const mockReminderDeleteMany = vi.fn().mockResolvedValue({ count: 1 })
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue({ projectId: 'p1', project: { isCompleted: false } }),
          delete: vi.fn().mockResolvedValue({ id: 's1', projectId: 'p1' }),
        },
        reminder: { deleteMany: mockReminderDeleteMany },
        stepImage: { findMany: vi.fn().mockResolvedValue([]) },
      }
      return fn(tx as never)
    })

    const result = await deleteStep('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    expect(mockReminderDeleteMany).toHaveBeenCalledWith({
      where: { targetId: '550e8400-e29b-41d4-a716-446655440000' },
    })
    expect(mockProjectUpdate).toHaveBeenCalled()
  })

  it('returns error when step not found', async () => {
    mockTransaction.mockRejectedValue({ code: 'P2025' })

    const result = await deleteStep('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })

  describe('Story 28.1: storage cleanup on cascade', () => {
    it('calls adapter.deleteObject for each UPLOAD storageKey from step_image', async () => {
      const deleteObject = vi.fn().mockResolvedValue(undefined)
      mockGetAdapter.mockReturnValue({
        deleteObject,
      } as unknown as ReturnType<typeof getImageStorageAdapter>)

      const stepImageFindMany = vi
        .fn()
        .mockResolvedValue([{ storageKey: 'steps/abc/1.jpg' }, { storageKey: 'steps/abc/2.jpg' }])
      mockTransaction.mockImplementation(async (fn) => {
        const tx = {
          step: {
            findUniqueOrThrow: vi
              .fn()
              .mockResolvedValue({ projectId: 'p1', project: { isCompleted: false } }),
            delete: vi.fn().mockResolvedValue({ id: 's1', projectId: 'p1' }),
          },
          reminder: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          stepImage: { findMany: stepImageFindMany },
        }
        return fn(tx as never)
      })

      const result = await deleteStep('550e8400-e29b-41d4-a716-446655440000')
      expect(result.success).toBe(true)
      expect(stepImageFindMany).toHaveBeenCalledWith({
        where: {
          stepId: '550e8400-e29b-41d4-a716-446655440000',
          type: 'UPLOAD',
          storageKey: { not: null },
        },
        select: { storageKey: true },
      })
      expect(deleteObject).toHaveBeenCalledTimes(2)
      expect(deleteObject).toHaveBeenCalledWith('steps/abc/1.jpg')
      expect(deleteObject).toHaveBeenCalledWith('steps/abc/2.jpg')
    })

    it('still returns success when adapter.deleteObject throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const deleteObject = vi.fn().mockRejectedValue(new Error('S3 down'))
      mockGetAdapter.mockReturnValue({
        deleteObject,
      } as unknown as ReturnType<typeof getImageStorageAdapter>)

      mockTransaction.mockImplementation(async (fn) => {
        const tx = {
          step: {
            findUniqueOrThrow: vi
              .fn()
              .mockResolvedValue({ projectId: 'p1', project: { isCompleted: false } }),
            delete: vi.fn().mockResolvedValue({ id: 's1', projectId: 'p1' }),
          },
          reminder: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          stepImage: {
            findMany: vi.fn().mockResolvedValue([{ storageKey: 'steps/abc/1.jpg' }]),
          },
        }
        return fn(tx as never)
      })

      const result = await deleteStep('550e8400-e29b-41d4-a716-446655440000')
      expect(result.success).toBe(true)
      expect(deleteObject).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Storage cleanup failed:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })

    it('does not call adapter.deleteObject when only LINK images exist (findMany returns empty)', async () => {
      const deleteObject = vi.fn()
      mockGetAdapter.mockReturnValue({
        deleteObject,
      } as unknown as ReturnType<typeof getImageStorageAdapter>)

      mockTransaction.mockImplementation(async (fn) => {
        const tx = {
          step: {
            findUniqueOrThrow: vi
              .fn()
              .mockResolvedValue({ projectId: 'p1', project: { isCompleted: false } }),
            delete: vi.fn().mockResolvedValue({ id: 's1', projectId: 'p1' }),
          },
          reminder: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          stepImage: { findMany: vi.fn().mockResolvedValue([]) },
        }
        return fn(tx as never)
      })

      const result = await deleteStep('550e8400-e29b-41d4-a716-446655440000')
      expect(result.success).toBe(true)
      expect(deleteObject).not.toHaveBeenCalled()
    })

    it('skips storage cleanup with a single console.warn when adapter is unavailable', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockGetAdapter.mockReturnValue(null)

      mockTransaction.mockImplementation(async (fn) => {
        const tx = {
          step: {
            findUniqueOrThrow: vi
              .fn()
              .mockResolvedValue({ projectId: 'p1', project: { isCompleted: false } }),
            delete: vi.fn().mockResolvedValue({ id: 's1', projectId: 'p1' }),
          },
          reminder: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          stepImage: {
            findMany: vi.fn().mockResolvedValue([{ storageKey: 'steps/abc/1.jpg' }]),
          },
        }
        return fn(tx as never)
      })

      const result = await deleteStep('550e8400-e29b-41d4-a716-446655440000')
      expect(result.success).toBe(true)
      expect(consoleWarnSpy).toHaveBeenCalledWith('Storage cleanup skipped — adapter unavailable')
      consoleWarnSpy.mockRestore()
    })
  })
})

describe('updateStepState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectUpdate.mockResolvedValue({ hobbyId: 'h1' } as never)
  })

  it('rejects invalid state', async () => {
    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'INVALID' as never,
    })
    expect(result.success).toBe(false)
  })

  function makeStepStateTx(
    existing: {
      state: string
      previousState: string | null
      projectId?: string
      project?: { isCompleted: boolean }
    },
    siblingsAfter: { state: string }[] = [{ state: 'NOT_STARTED' }],
  ) {
    const mockStepUpdate = vi
      .fn()
      .mockResolvedValue({ id: 's1', projectId: existing.projectId ?? 'p1' })
    const mockStepFindMany = vi.fn().mockResolvedValue(siblingsAfter)
    const mockProjectUpdateTx = vi.fn().mockResolvedValue({})
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            ...existing,
            projectId: existing.projectId ?? 'p1',
            project: existing.project ?? { isCompleted: false },
          }),
          update: mockStepUpdate,
          findMany: mockStepFindMany,
        },
        project: { update: mockProjectUpdateTx },
      }
      return fn(tx as never)
    })
    return { mockStepUpdate, mockStepFindMany, mockProjectUpdateTx }
  }

  it('updates step state and project lastActivityAt', async () => {
    makeStepStateTx({ state: 'NOT_STARTED', previousState: null })

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'IN_PROGRESS',
    })
    expect(result.success).toBe(true)
    expect(mockProjectUpdate).toHaveBeenCalled()
  })

  it('saves previousState when transitioning to BLOCKED', async () => {
    const { mockStepUpdate } = makeStepStateTx({ state: 'IN_PROGRESS', previousState: null })

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'BLOCKED',
    })
    expect(result.success).toBe(true)
    expect(mockStepUpdate).toHaveBeenCalledWith({
      where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      data: { state: 'BLOCKED', previousState: 'IN_PROGRESS' },
    })
  })

  it('restores previousState when transitioning from BLOCKED', async () => {
    const { mockStepUpdate } = makeStepStateTx({ state: 'BLOCKED', previousState: 'IN_PROGRESS' })

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'NOT_STARTED',
    })
    expect(result.success).toBe(true)
    expect(mockStepUpdate).toHaveBeenCalledWith({
      where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      data: { state: 'IN_PROGRESS', previousState: null },
    })
  })

  it('allows COMPLETED to NOT_STARTED revert', async () => {
    const { mockStepUpdate } = makeStepStateTx({ state: 'COMPLETED', previousState: null })

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'NOT_STARTED',
    })
    expect(result.success).toBe(true)
    expect(mockStepUpdate).toHaveBeenCalledWith({
      where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      data: { state: 'NOT_STARTED', previousState: null },
    })
  })

  it('clears previousState on normal transitions', async () => {
    const { mockStepUpdate } = makeStepStateTx({ state: 'NOT_STARTED', previousState: null })

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'COMPLETED',
    })
    expect(result.success).toBe(true)
    expect(mockStepUpdate).toHaveBeenCalledWith({
      where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      data: { state: 'COMPLETED', previousState: null },
    })
  })

  // Story 30.3 / FR127: project.isCompleted is no longer auto-toggled by
  // updateStepState. Completion is an explicit user action via the dialog
  // or the project meatball menu. Verify that the action does NOT call
  // project.update for the isCompleted flag, even when this transition
  // brings every step to COMPLETED — and that the result exposes
  // `allStepsCompleted: true` so the client can open the dialog.
  it('does NOT auto-toggle project.isCompleted when all steps become COMPLETED (Story 30.3)', async () => {
    const { mockProjectUpdateTx } = makeStepStateTx({ state: 'IN_PROGRESS', previousState: null }, [
      { state: 'COMPLETED' },
      { state: 'COMPLETED' },
    ])

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'COMPLETED',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.allStepsCompleted).toBe(true)
    }
    expect(mockProjectUpdateTx).not.toHaveBeenCalled()
  })

  it('returns allStepsCompleted=false when at least one step is still incomplete', async () => {
    const { mockProjectUpdateTx } = makeStepStateTx({ state: 'IN_PROGRESS', previousState: null }, [
      { state: 'COMPLETED' },
      { state: 'IN_PROGRESS' },
    ])

    const result = await updateStepState({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'COMPLETED',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.allStepsCompleted).toBe(false)
    }
    expect(mockProjectUpdateTx).not.toHaveBeenCalled()
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
    expect(mockStepUpdateTx).toHaveBeenCalledWith({
      where: { id: stepId3 },
      data: { sortOrder: 0 },
    })
    expect(mockStepUpdateTx).toHaveBeenCalledWith({
      where: { id: stepId1 },
      data: { sortOrder: 1 },
    })
    expect(mockStepUpdateTx).toHaveBeenCalledWith({
      where: { id: stepId2 },
      data: { sortOrder: 2 },
    })

    // Should call updateProjectActivity (revalidatePath + lastActivityAt)
    expect(mockProjectUpdate).toHaveBeenCalled()
  })
})

describe('setStepHours (Story 30.5 / FR129)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectUpdate.mockResolvedValue({ hobbyId: 'h1' } as never)
  })

  const VALID_STEP_ID = '550e8400-e29b-41d4-a716-446655440000'

  it('rejects invalid uuid', async () => {
    const result = await setStepHours({ id: 'not-a-uuid', hours: 1 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
  })

  it('rejects negative hours', async () => {
    const result = await setStepHours({ id: VALID_STEP_ID, hours: -1 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('non-negative multiple of 0.5')
  })

  it('rejects fractional hours that are not 0.5 multiples', async () => {
    const result = await setStepHours({ id: VALID_STEP_ID, hours: 0.7 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('non-negative multiple of 0.5')
  })

  it('accepts null (clears the value)', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue({ projectId: 'p1', project: { isCompleted: false } }),
          update: vi.fn().mockResolvedValue({ projectId: 'p1' }),
        },
      }
      return fn(tx as never)
    })
    const result = await setStepHours({ id: VALID_STEP_ID, hours: null })
    expect(result.success).toBe(true)
  })

  it('accepts a 0.5 multiple and persists it', async () => {
    const stepUpdate = vi.fn().mockResolvedValue({ projectId: 'p1' })
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue({ projectId: 'p1', project: { isCompleted: false } }),
          update: stepUpdate,
        },
      }
      return fn(tx as never)
    })
    const result = await setStepHours({ id: VALID_STEP_ID, hours: 2.5 })
    expect(result.success).toBe(true)
    expect(stepUpdate).toHaveBeenCalledWith({
      where: { id: VALID_STEP_ID },
      data: { hoursLogged: 2.5 },
      select: { projectId: true },
    })
  })

  it('blocks when project is completed', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue({ projectId: 'p1', project: { isCompleted: true } }),
          update: vi.fn(),
        },
      }
      return fn(tx as never)
    })
    const result = await setStepHours({ id: VALID_STEP_ID, hours: 1 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Cannot modify steps on a completed project.')
  })

  it('returns "Step not found." on Prisma P2025', async () => {
    mockTransaction.mockRejectedValue({ code: 'P2025' })
    const result = await setStepHours({ id: VALID_STEP_ID, hours: 1 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })
})
