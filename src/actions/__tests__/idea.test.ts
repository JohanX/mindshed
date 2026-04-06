import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    hobby: {
      findUnique: vi.fn(),
    },
    idea: {
      create: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createIdea } from '../idea'
import { prisma } from '@/lib/db'

const mockHobbyFindUnique = vi.mocked(prisma.hobby.findUnique)
const mockIdeaCreate = vi.mocked(prisma.idea.create)

const validUuid = '550e8400-e29b-41d4-a716-446655440000'

describe('createIdea', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid hobbyId', async () => {
    const result = await createIdea({ hobbyId: 'bad', title: 'Test' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
  })

  it('rejects empty title', async () => {
    const result = await createIdea({ hobbyId: validUuid, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid referenceLink', async () => {
    const result = await createIdea({
      hobbyId: validUuid,
      title: 'Test',
      referenceLink: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('returns error when hobby not found', async () => {
    mockHobbyFindUnique.mockResolvedValue(null)

    const result = await createIdea({ hobbyId: validUuid, title: 'Test' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Hobby not found.')
  })

  it('creates idea on success', async () => {
    mockHobbyFindUnique.mockResolvedValue({ id: validUuid } as never)
    mockIdeaCreate.mockResolvedValue({ id: 'idea-1' } as never)

    const result = await createIdea({
      hobbyId: validUuid,
      title: 'Build a shelf',
      description: 'Floating shelf',
      referenceLink: 'https://example.com',
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('idea-1')

    expect(mockIdeaCreate).toHaveBeenCalledWith({
      data: {
        hobbyId: validUuid,
        title: 'Build a shelf',
        description: 'Floating shelf',
        referenceLink: 'https://example.com',
      },
    })
  })

  it('creates idea with empty string referenceLink transformed to null', async () => {
    mockHobbyFindUnique.mockResolvedValue({ id: validUuid } as never)
    mockIdeaCreate.mockResolvedValue({ id: 'idea-2' } as never)

    const result = await createIdea({
      hobbyId: validUuid,
      title: 'Quick thought',
      referenceLink: '',
    })

    expect(result.success).toBe(true)
    expect(mockIdeaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        referenceLink: null,
      }),
    })
  })

  it('handles Prisma errors gracefully', async () => {
    mockHobbyFindUnique.mockResolvedValue({ id: validUuid } as never)
    mockIdeaCreate.mockRejectedValue(new Error('DB error'))

    const result = await createIdea({ hobbyId: validUuid, title: 'Test' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Failed to create idea')
  })
})
