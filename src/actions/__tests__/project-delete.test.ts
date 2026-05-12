import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(),
}))

import { deleteProject } from '../project'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'

const mockTransaction = vi.mocked(prisma.$transaction)
const mockRevalidatePath = vi.mocked(revalidatePath)
const mockGetAdapter = vi.mocked(getImageStorageAdapter)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('deleteProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid id', async () => {
    const result = await deleteProject('bad')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
  })

  it('deletes project, cleans up reminders for project and its steps', async () => {
    const mockReminderDeleteMany = vi.fn().mockResolvedValue({ count: 3 })
    const mockStepFindMany = vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    const mockProjectDelete = vi.fn().mockResolvedValue({ id: VALID_UUID, hobbyId: 'h1' })

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: { findMany: mockStepFindMany },
        reminder: { deleteMany: mockReminderDeleteMany },
        project: { delete: mockProjectDelete },
        stepImage: { findMany: vi.fn().mockResolvedValue([]) },
      }
      return fn(tx as never)
    })

    const result = await deleteProject(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.hobbyId).toBe('h1')

    expect(mockStepFindMany).toHaveBeenCalledWith({
      where: { projectId: VALID_UUID },
      select: { id: true },
    })
    expect(mockReminderDeleteMany).toHaveBeenCalledWith({
      where: { targetId: { in: [VALID_UUID, 's1', 's2'] } },
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/hobbies/h1')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })

  it('handles project with zero steps (only project reminder cleaned)', async () => {
    const mockReminderDeleteMany = vi.fn().mockResolvedValue({ count: 1 })
    const mockStepFindMany = vi.fn().mockResolvedValue([])
    const mockProjectDelete = vi.fn().mockResolvedValue({ id: VALID_UUID, hobbyId: 'h1' })

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: { findMany: mockStepFindMany },
        reminder: { deleteMany: mockReminderDeleteMany },
        project: { delete: mockProjectDelete },
        stepImage: { findMany: vi.fn().mockResolvedValue([]) },
      }
      return fn(tx as never)
    })

    const result = await deleteProject(VALID_UUID)
    expect(result.success).toBe(true)
    expect(mockReminderDeleteMany).toHaveBeenCalledWith({
      where: { targetId: { in: [VALID_UUID] } },
    })
  })

  describe('Story 28.1: storage cleanup on cascade', () => {
    it('calls adapter.deleteObject for each step_image storageKey across the project', async () => {
      const deleteObject = vi.fn().mockResolvedValue(undefined)
      mockGetAdapter.mockReturnValue({
        deleteObject,
      } as unknown as ReturnType<typeof getImageStorageAdapter>)

      const stepImageFindMany = vi
        .fn()
        .mockResolvedValue([
          { storageKey: 'steps/s1/a.jpg' },
          { storageKey: 'steps/s1/b.jpg' },
          { storageKey: 'steps/s2/c.jpg' },
        ])

      mockTransaction.mockImplementation(async (fn) => {
        const tx = {
          step: { findMany: vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]) },
          reminder: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          project: {
            delete: vi.fn().mockResolvedValue({ id: VALID_UUID, hobbyId: 'h1' }),
          },
          stepImage: { findMany: stepImageFindMany },
        }
        return fn(tx as never)
      })

      const result = await deleteProject(VALID_UUID)
      expect(result.success).toBe(true)
      expect(stepImageFindMany).toHaveBeenCalledWith({
        where: {
          stepId: { in: ['s1', 's2'] },
          type: 'UPLOAD',
          storageKey: { not: null },
        },
        select: { storageKey: true, mediaType: true },
      })
      expect(deleteObject).toHaveBeenCalledTimes(3)
    })

    it('still returns success when adapter.deleteObject throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetAdapter.mockReturnValue({
        deleteObject: vi.fn().mockRejectedValue(new Error('adapter down')),
      } as unknown as ReturnType<typeof getImageStorageAdapter>)

      mockTransaction.mockImplementation(async (fn) => {
        const tx = {
          step: { findMany: vi.fn().mockResolvedValue([{ id: 's1' }]) },
          reminder: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          project: {
            delete: vi.fn().mockResolvedValue({ id: VALID_UUID, hobbyId: 'h1' }),
          },
          stepImage: {
            findMany: vi.fn().mockResolvedValue([{ storageKey: 'steps/s1/a.jpg' }]),
          },
        }
        return fn(tx as never)
      })

      const result = await deleteProject(VALID_UUID)
      expect(result.success).toBe(true)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Storage cleanup failed:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })

    it('does not call adapter.deleteObject when only LINK images exist', async () => {
      const deleteObject = vi.fn()
      mockGetAdapter.mockReturnValue({
        deleteObject,
      } as unknown as ReturnType<typeof getImageStorageAdapter>)

      mockTransaction.mockImplementation(async (fn) => {
        const tx = {
          step: { findMany: vi.fn().mockResolvedValue([{ id: 's1' }]) },
          reminder: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          project: {
            delete: vi.fn().mockResolvedValue({ id: VALID_UUID, hobbyId: 'h1' }),
          },
          stepImage: { findMany: vi.fn().mockResolvedValue([]) },
        }
        return fn(tx as never)
      })

      const result = await deleteProject(VALID_UUID)
      expect(result.success).toBe(true)
      expect(deleteObject).not.toHaveBeenCalled()
    })
  })

  it('returns error when project not found', async () => {
    mockTransaction.mockRejectedValue({ code: 'P2025' })

    const result = await deleteProject(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Project not found.')
  })

  it('returns generic error on unexpected failure', async () => {
    mockTransaction.mockRejectedValue(new Error('DB error'))

    const result = await deleteProject(VALID_UUID)
    expect(result.success).toBe(false)
  })
})
