import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    hobby: {
      findUnique: vi.fn(),
    },
    idea: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createIdea, getIdeasByHobby, getAllIdeas, promoteIdea } from '../idea'
import { prisma } from '@/lib/db'

const mockHobbyFindUnique = vi.mocked(prisma.hobby.findUnique)
const mockIdeaCreate = vi.mocked(prisma.idea.create)
const mockIdeaFindMany = vi.mocked(prisma.idea.findMany)
const mockTransaction = vi.mocked(prisma.$transaction)

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

describe('getIdeasByHobby', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid hobbyId', async () => {
    const result = await getIdeasByHobby('not-a-uuid')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid hobby ID')
    expect(mockIdeaFindMany).not.toHaveBeenCalled()
  })

  it('returns ideas sorted by isPromoted asc then createdAt desc', async () => {
    const mockIdeas = [
      { id: '1', title: 'Unpromoted new', isPromoted: false, createdAt: new Date('2026-03-02') },
      { id: '2', title: 'Unpromoted old', isPromoted: false, createdAt: new Date('2026-03-01') },
      { id: '3', title: 'Promoted', isPromoted: true, createdAt: new Date('2026-03-03') },
    ]
    mockIdeaFindMany.mockResolvedValue(mockIdeas as never)

    const result = await getIdeasByHobby(validUuid)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(3)
    }
    expect(mockIdeaFindMany).toHaveBeenCalledWith({
      where: { hobbyId: validUuid },
      orderBy: [{ isPromoted: 'asc' }, { createdAt: 'desc' }],
    })
  })

  it('returns empty array when no ideas exist', async () => {
    mockIdeaFindMany.mockResolvedValue([])

    const result = await getIdeasByHobby(validUuid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
  })

  it('handles Prisma errors gracefully', async () => {
    mockIdeaFindMany.mockRejectedValue(new Error('DB error'))

    const result = await getIdeasByHobby(validUuid)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Failed to load ideas.')
  })
})

describe('getAllIdeas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ideas with hobby data sorted by createdAt desc', async () => {
    const mockIdeas = [
      {
        id: '1',
        title: 'Newest idea',
        createdAt: new Date('2026-04-02'),
        hobby: { id: 'h1', name: 'Woodworking', color: '#B87333', icon: 'hammer' },
      },
      {
        id: '2',
        title: 'Older idea',
        createdAt: new Date('2026-04-01'),
        hobby: { id: 'h2', name: 'Painting', color: '#4A90D9', icon: 'paintbrush' },
      },
    ]
    mockIdeaFindMany.mockResolvedValue(mockIdeas as never)

    const result = await getAllIdeas()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].hobby.name).toBe('Woodworking')
      expect(result.data[1].hobby.name).toBe('Painting')
    }
    expect(mockIdeaFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      include: { hobby: { select: { id: true, name: true, color: true, icon: true } } },
    })
  })

  it('returns empty array when no ideas exist', async () => {
    mockIdeaFindMany.mockResolvedValue([])

    const result = await getAllIdeas()
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
  })

  it('handles Prisma errors gracefully', async () => {
    mockIdeaFindMany.mockRejectedValue(new Error('DB error'))

    const result = await getAllIdeas()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Failed to load ideas.')
  })
})

// ==========================================================================
// promoteIdea — Story 18.4
// ==========================================================================

describe('promoteIdea', () => {
  beforeEach(() => vi.clearAllMocks())

  function buildPromoteTx(opts: {
    idea?: {
      id: string
      title: string
      description: string | null
      hobbyId: string
      isPromoted: boolean
    } | null
    hobby?: { id: string } | null
    projectId?: string
  }) {
    return {
      idea: {
        findUnique: vi.fn(async () =>
          opts.idea === null ? null : (opts.idea ?? defaultIdea()),
        ),
        update: vi.fn(async () => ({ id: opts.idea?.id ?? defaultIdea().id })),
      },
      hobby: {
        findUnique: vi.fn(async () =>
          opts.hobby === null ? null : (opts.hobby ?? { id: 'hobby-1' }),
        ),
      },
      project: {
        create: vi.fn(async () => ({ id: opts.projectId ?? 'new-project' })),
      },
    }
  }

  function defaultIdea() {
    return {
      id: validUuid,
      title: 'Curved bookends',
      description: 'Walnut with resin inlays',
      hobbyId: 'hobby-1',
      isPromoted: false,
    }
  }

  it('rejects invalid UUID', async () => {
    const result = await promoteIdea('bad')
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('happy path — creates a project and marks idea promoted', async () => {
    const tx = buildPromoteTx({ projectId: 'p-new' })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await promoteIdea(validUuid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.projectId).toBe('p-new')

    expect(tx.project.create).toHaveBeenCalledOnce()
    const createArg = tx.project.create.mock.calls[0][0] as {
      data: { name: string; description: string | null; hobbyId: string; lastActivityAt: Date }
    }
    expect(createArg.data.name).toBe('Curved bookends')
    expect(createArg.data.description).toBe('Walnut with resin inlays')
    expect(createArg.data.hobbyId).toBe('hobby-1')
    expect(createArg.data.lastActivityAt).toBeInstanceOf(Date)

    expect(tx.idea.update).toHaveBeenCalledOnce()
    const updateArg = tx.idea.update.mock.calls[0][0] as {
      data: { isPromoted: boolean }
    }
    expect(updateArg.data.isPromoted).toBe(true)
  })

  it('rejects when idea not found', async () => {
    const tx = buildPromoteTx({ idea: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await promoteIdea(validUuid)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Idea not found.')
  })

  it('rejects when idea already promoted', async () => {
    const tx = buildPromoteTx({
      idea: { ...defaultIdea(), isPromoted: true },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await promoteIdea(validUuid)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Idea already promoted.')
    expect(tx.project.create).not.toHaveBeenCalled()
  })

  it('rejects when parent hobby missing (soft-deleted race)', async () => {
    const tx = buildPromoteTx({ hobby: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await promoteIdea(validUuid)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Hobby not found.')
    expect(tx.project.create).not.toHaveBeenCalled()
  })
})
