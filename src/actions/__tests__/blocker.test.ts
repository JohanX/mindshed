import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    blocker: {
      create: vi.fn(),
    },
    step: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

import { createBlocker } from '../blocker'
import { prisma } from '@/lib/db'

const mockTransaction = vi.mocked(prisma.$transaction)

const STEP_ID = '550e8400-e29b-41d4-a716-446655440000'
const PROJECT_ID = '660e8400-e29b-41d4-a716-446655440001'
const HOBBY_ID = '770e8400-e29b-41d4-a716-446655440002'
const BLOCKER_ID = '880e8400-e29b-41d4-a716-446655440003'

describe('createBlocker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid stepId', async () => {
    const result = await createBlocker({ stepId: 'bad', description: 'Blocked' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
  })

  it('rejects empty description', async () => {
    const result = await createBlocker({ stepId: STEP_ID, description: '' })
    expect(result.success).toBe(false)
  })

  it('rejects description over 500 chars', async () => {
    const result = await createBlocker({ stepId: STEP_ID, description: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('creates blocker and transitions NOT_STARTED step to BLOCKED', async () => {
    const mockStepUpdate = vi.fn().mockResolvedValue({})
    const mockBlockerCreate = vi.fn().mockResolvedValue({
      id: BLOCKER_ID,
      description: 'Waiting for parts',
      isResolved: false,
    })

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUnique: vi.fn().mockResolvedValue({
            id: STEP_ID,
            state: 'NOT_STARTED',
            previousState: null,
            projectId: PROJECT_ID,
          }),
          update: mockStepUpdate,
        },
        blocker: {
          create: mockBlockerCreate,
        },
        project: {
          update: vi.fn().mockResolvedValue({ hobbyId: HOBBY_ID }),
        },
      }
      return fn(tx as never)
    })

    const result = await createBlocker({ stepId: STEP_ID, description: 'Waiting for parts' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe(BLOCKER_ID)
      expect(result.data.description).toBe('Waiting for parts')
      expect(result.data.isResolved).toBe(false)
    }

    // Step should be updated to BLOCKED with previousState saved
    expect(mockStepUpdate).toHaveBeenCalledWith({
      where: { id: STEP_ID },
      data: { previousState: 'NOT_STARTED', state: 'BLOCKED' },
    })
  })

  it('creates blocker and transitions IN_PROGRESS step to BLOCKED', async () => {
    const mockStepUpdate = vi.fn().mockResolvedValue({})

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUnique: vi.fn().mockResolvedValue({
            id: STEP_ID,
            state: 'IN_PROGRESS',
            previousState: null,
            projectId: PROJECT_ID,
          }),
          update: mockStepUpdate,
        },
        blocker: {
          create: vi.fn().mockResolvedValue({
            id: BLOCKER_ID,
            description: 'Need more paint',
            isResolved: false,
          }),
        },
        project: {
          update: vi.fn().mockResolvedValue({ hobbyId: HOBBY_ID }),
        },
      }
      return fn(tx as never)
    })

    const result = await createBlocker({ stepId: STEP_ID, description: 'Need more paint' })
    expect(result.success).toBe(true)

    expect(mockStepUpdate).toHaveBeenCalledWith({
      where: { id: STEP_ID },
      data: { previousState: 'IN_PROGRESS', state: 'BLOCKED' },
    })
  })

  it('does not overwrite previousState when step is already BLOCKED', async () => {
    const mockStepUpdate = vi.fn()

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUnique: vi.fn().mockResolvedValue({
            id: STEP_ID,
            state: 'BLOCKED',
            previousState: 'IN_PROGRESS',
            projectId: PROJECT_ID,
          }),
          update: mockStepUpdate,
        },
        blocker: {
          create: vi.fn().mockResolvedValue({
            id: BLOCKER_ID,
            description: 'Another blocker',
            isResolved: false,
          }),
        },
        project: {
          update: vi.fn().mockResolvedValue({ hobbyId: HOBBY_ID }),
        },
      }
      return fn(tx as never)
    })

    const result = await createBlocker({ stepId: STEP_ID, description: 'Another blocker' })
    expect(result.success).toBe(true)

    // Step.update should NOT have been called (state already BLOCKED)
    expect(mockStepUpdate).not.toHaveBeenCalled()
  })

  it('updates lastActivityAt on parent project', async () => {
    const mockProjectUpdate = vi.fn().mockResolvedValue({ hobbyId: HOBBY_ID })

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUnique: vi.fn().mockResolvedValue({
            id: STEP_ID,
            state: 'NOT_STARTED',
            previousState: null,
            projectId: PROJECT_ID,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        blocker: {
          create: vi.fn().mockResolvedValue({
            id: BLOCKER_ID,
            description: 'Blocked',
            isResolved: false,
          }),
        },
        project: {
          update: mockProjectUpdate,
        },
      }
      return fn(tx as never)
    })

    await createBlocker({ stepId: STEP_ID, description: 'Blocked' })

    expect(mockProjectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROJECT_ID },
        data: expect.objectContaining({ lastActivityAt: expect.any(Date) }),
      }),
    )
  })

  it('returns error when step not found', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
        blocker: {
          create: vi.fn(),
        },
        project: {
          update: vi.fn(),
        },
      }
      return fn(tx as never)
    })

    const result = await createBlocker({ stepId: STEP_ID, description: 'Blocked' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })
})
