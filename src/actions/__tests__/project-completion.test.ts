import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      update: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { completeProject, uncompleteProject } from '../project'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const mockProjectUpdate = vi.mocked(prisma.project.update)
const mockRevalidatePath = vi.mocked(revalidatePath)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const HOBBY_ID = 'hobby-1'

describe('completeProject (Story 30.3 / FR127)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid uuid', async () => {
    const result = await completeProject('not-a-uuid')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
    expect(mockProjectUpdate).not.toHaveBeenCalled()
  })

  it('sets isCompleted=true, updates lastActivityAt, and revalidates the project paths', async () => {
    mockProjectUpdate.mockResolvedValue({
      id: VALID_UUID,
      hobbyId: HOBBY_ID,
    } as never)

    const result = await completeProject(VALID_UUID)
    expect(result.success).toBe(true)

    expect(mockProjectUpdate).toHaveBeenCalledTimes(1)
    const updateArg = mockProjectUpdate.mock.calls[0]?.[0]
    expect(updateArg).toMatchObject({
      where: { id: VALID_UUID },
      data: expect.objectContaining({ isCompleted: true }),
    })
    expect(updateArg?.data?.lastActivityAt).toBeInstanceOf(Date)

    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hobbies/${HOBBY_ID}/projects/${VALID_UUID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hobbies/${HOBBY_ID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })

  it('returns "Project not found." on Prisma P2025', async () => {
    mockProjectUpdate.mockRejectedValue({ code: 'P2025' })

    const result = await completeProject(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Project not found.')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns generic error on unexpected failure', async () => {
    mockProjectUpdate.mockRejectedValue(new Error('boom'))

    const result = await completeProject(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Failed to complete project.')
  })
})

describe('uncompleteProject (Story 30.3 / FR127)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid uuid', async () => {
    const result = await uncompleteProject('not-a-uuid')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
    expect(mockProjectUpdate).not.toHaveBeenCalled()
  })

  it('sets isCompleted=false, updates lastActivityAt, and revalidates the project paths', async () => {
    mockProjectUpdate.mockResolvedValue({
      id: VALID_UUID,
      hobbyId: HOBBY_ID,
    } as never)

    const result = await uncompleteProject(VALID_UUID)
    expect(result.success).toBe(true)

    expect(mockProjectUpdate).toHaveBeenCalledTimes(1)
    const updateArg = mockProjectUpdate.mock.calls[0]?.[0]
    expect(updateArg).toMatchObject({
      where: { id: VALID_UUID },
      data: expect.objectContaining({ isCompleted: false }),
    })
    expect(updateArg?.data?.lastActivityAt).toBeInstanceOf(Date)

    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hobbies/${HOBBY_ID}/projects/${VALID_UUID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hobbies/${HOBBY_ID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })

  it('returns "Project not found." on Prisma P2025', async () => {
    mockProjectUpdate.mockRejectedValue({ code: 'P2025' })

    const result = await uncompleteProject(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Project not found.')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns generic error on unexpected failure', async () => {
    mockProjectUpdate.mockRejectedValue(new Error('boom'))

    const result = await uncompleteProject(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Failed to unlock project.')
  })
})
