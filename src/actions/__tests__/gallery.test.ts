import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    step: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { enableJourneyGallery, disableJourneyGallery, enableResultGallery, disableResultGallery, setResultStep, toggleStepGalleryExclusion } from '../gallery'
import { prisma } from '@/lib/db'

const mockTransaction = vi.mocked(prisma.$transaction)
const mockProjectUpdate = vi.mocked(prisma.project.update)
const mockStepFindUnique = vi.mocked(prisma.step.findUnique)
const mockStepUpdate = vi.mocked(prisma.step.update)

describe('enableJourneyGallery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid projectId', async () => {
    const result = await enableJourneyGallery('bad')
    expect(result.success).toBe(false)
  })

  it('generates slug and enables journey gallery', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: {
          findUnique: vi.fn().mockResolvedValue({ id: 'p1', name: 'Walnut Table', gallerySlug: null, hobbyId: 'h1', isArchived: false }),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockResolvedValue({ id: 'p1', gallerySlug: 'walnut-table', hobbyId: 'h1' }),
        },
      }
      return fn(tx as never)
    })

    const result = await enableJourneyGallery('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.slug).toBe('walnut-table')
  })

  it('reuses existing slug when re-enabling', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: {
          findUnique: vi.fn().mockResolvedValue({ id: 'p1', name: 'Walnut Table', gallerySlug: 'walnut-table', hobbyId: 'h1', isArchived: false }),
          update: vi.fn().mockResolvedValue({ id: 'p1', gallerySlug: 'walnut-table', hobbyId: 'h1' }),
        },
      }
      return fn(tx as never)
    })

    const result = await enableJourneyGallery('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.slug).toBe('walnut-table')
  })

  it('returns error when project not found', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: { findUnique: vi.fn().mockResolvedValue(null) },
      }
      return fn(tx as never)
    })

    const result = await enableJourneyGallery('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Project not found.')
  })
})

describe('disableJourneyGallery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('disables journey gallery', async () => {
    mockProjectUpdate.mockResolvedValue({ id: 'p1', hobbyId: 'h1' } as never)

    const result = await disableJourneyGallery('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    expect(mockProjectUpdate).toHaveBeenCalledWith({
      where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      data: { journeyGalleryEnabled: false },
      select: { id: true, hobbyId: true },
    })
  })
})

describe('enableResultGallery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('enables result gallery with last completed step', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'p1', name: 'Walnut Table', gallerySlug: 'walnut-table', hobbyId: 'h1', isArchived: false,
            resultStepId: null,
            steps: [{ id: 's3' }],
          }),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockResolvedValue({ id: 'p1', gallerySlug: 'walnut-table', hobbyId: 'h1' }),
        },
      }
      return fn(tx as never)
    })

    const result = await enableResultGallery('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
  })

  it('preserves existing resultStepId when step is still COMPLETED', async () => {
    const mockProjectUpdateTx = vi.fn().mockResolvedValue({ id: 'p1', gallerySlug: 'walnut-table', hobbyId: 'h1' })
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        project: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'p1', name: 'Walnut Table', gallerySlug: 'walnut-table', hobbyId: 'h1',
            resultStepId: 's2', isArchived: false,
            steps: [{ id: 's3' }],
          }),
          findMany: vi.fn().mockResolvedValue([]),
          update: mockProjectUpdateTx,
        },
        step: {
          findUnique: vi.fn().mockResolvedValue({ state: 'COMPLETED' }),
        },
      }
      return fn(tx as never)
    })

    await enableResultGallery('550e8400-e29b-41d4-a716-446655440000')
    expect(mockProjectUpdateTx).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resultStepId: 's2' }),
    }))
  })
})

describe('disableResultGallery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('disables result gallery', async () => {
    mockProjectUpdate.mockResolvedValue({ id: 'p1', hobbyId: 'h1' } as never)

    const result = await disableResultGallery('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
  })
})

describe('setResultStep', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid IDs', async () => {
    const result = await setResultStep('bad', 'bad')
    expect(result.success).toBe(false)
  })

  it('rejects step not in project', async () => {
    mockStepFindUnique.mockResolvedValue({ projectId: 'other-project' } as never)

    const result = await setResultStep(
      '550e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440001',
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found in this project.')
  })

  it('updates result step', async () => {
    mockStepFindUnique.mockResolvedValue({ projectId: '550e8400-e29b-41d4-a716-446655440000', state: 'COMPLETED' } as never)
    mockProjectUpdate.mockResolvedValue({ id: 'p1', hobbyId: 'h1' } as never)

    const result = await setResultStep(
      '550e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440001',
    )
    expect(result.success).toBe(true)
  })
})

describe('toggleStepGalleryExclusion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid stepId', async () => {
    const result = await toggleStepGalleryExclusion('bad')
    expect(result.success).toBe(false)
  })

  it('toggles exclusion from false to true', async () => {
    mockStepFindUnique.mockResolvedValue({
      excludeFromGallery: false, projectId: 'p1', project: { hobbyId: 'h1' },
    } as never)
    mockStepUpdate.mockResolvedValue({} as never)

    const result = await toggleStepGalleryExclusion('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    expect(mockStepUpdate).toHaveBeenCalledWith({
      where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      data: { excludeFromGallery: true },
    })
  })

  it('toggles exclusion from true to false', async () => {
    mockStepFindUnique.mockResolvedValue({
      excludeFromGallery: true, projectId: 'p1', project: { hobbyId: 'h1' },
    } as never)
    mockStepUpdate.mockResolvedValue({} as never)

    const result = await toggleStepGalleryExclusion('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
    expect(mockStepUpdate).toHaveBeenCalledWith({
      where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      data: { excludeFromGallery: false },
    })
  })

  it('returns error when step not found', async () => {
    mockStepFindUnique.mockResolvedValue(null)

    const result = await toggleStepGalleryExclusion('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })
})
