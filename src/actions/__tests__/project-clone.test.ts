import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { cloneProject } from '../project'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const mockTransaction = vi.mocked(prisma.$transaction)
const mockRevalidatePath = vi.mocked(revalidatePath)

const validProjectId = '550e8400-e29b-41d4-a716-446655440000'

type StepMock = {
  id: string
  name: string
  sortOrder: number
  state: string
}

type SourceMock = {
  id: string
  name: string
  description: string | null
  hobbyId: string
  isCompleted: boolean
  isArchived: boolean
  journeyGalleryEnabled?: boolean
  resultGalleryEnabled?: boolean
  gallerySlug?: string | null
  resultStepId?: string | null
  steps: StepMock[]
  bomItems?: Array<{
    inventoryItemId: string | null
    label: string | null
    requiredQuantity: number
    unit: string | null
    sortOrder: number
    consumptionState: 'NOT_CONSUMED' | 'CONSUMED'
  }>
}

function buildTx(opts: {
  source: SourceMock | null
  existingNames?: string[]
  maxSortOrder?: number | null
  createdId?: string
  createError?: Error
}) {
  const projectCreate = vi.fn(async (args: { data: Record<string, unknown> }) => {
    if (opts.createError) throw opts.createError
    return { id: opts.createdId ?? 'new-project-id', ...args.data }
  })

  // Default bomItems to empty array so existing tests exercise the new
  // include path without per-test wiring.
  const sourceWithBom = opts.source ? { bomItems: [], ...opts.source } : opts.source

  return {
    project: {
      findUnique: vi.fn().mockResolvedValue(sourceWithBom),
      findMany: vi.fn().mockResolvedValue((opts.existingNames ?? []).map((name) => ({ name }))),
      aggregate: vi.fn().mockResolvedValue({
        _max: { sortOrder: opts.maxSortOrder ?? null },
      }),
      create: projectCreate,
    },
    stepNote: { create: vi.fn() },
    blocker: { create: vi.fn() },
    stepImage: { create: vi.fn() },
    bomItem: { create: vi.fn(), createMany: vi.fn() },
  }
}

describe('cloneProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid uuid', async () => {
    const result = await cloneProject('not-a-uuid')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid project ID.')
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns "Project not found." when source does not exist', async () => {
    const tx = buildTx({ source: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await cloneProject(validProjectId)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Project not found.')
  })

  it('clones with "(copy)" suffix when no prior copy exists', async () => {
    const tx = buildTx({
      source: {
        id: validProjectId,
        name: 'Knife',
        description: 'A nice knife',
        hobbyId: 'hobby-1',
        isCompleted: false,
        isArchived: false,
        steps: [
          { id: 'step-a', name: 'Grind bevels', sortOrder: 0, state: 'COMPLETED' },
          { id: 'step-b', name: 'Heat treat', sortOrder: 1, state: 'IN_PROGRESS' },
        ],
      },
      existingNames: [],
      maxSortOrder: 2,
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await cloneProject(validProjectId)

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.hobbyId).toBe('hobby-1')

    expect(tx.project.create).toHaveBeenCalledOnce()
    const payload = (tx.project.create.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(payload.name).toBe('Knife (copy)')
    expect(payload.description).toBe('A nice knife')
    expect(payload.hobbyId).toBe('hobby-1')
    expect(payload.sortOrder).toBe(3)
    expect(payload.lastActivityAt).toBeInstanceOf(Date)
  })

  it('does not set isCompleted, isArchived, or gallery fields on the clone even when the source has them all set', async () => {
    // Source has every leakable field turned on — the clone's `project.create`
    // payload must still rely on schema defaults for each.
    const tx = buildTx({
      source: {
        id: validProjectId,
        name: 'Knife',
        description: null,
        hobbyId: 'hobby-1',
        isCompleted: true,
        isArchived: true,
        journeyGalleryEnabled: true,
        resultGalleryEnabled: true,
        gallerySlug: 'knife',
        resultStepId: 'some-step-id',
        steps: [],
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await cloneProject(validProjectId)

    const payload = (tx.project.create.mock.calls[0][0] as { data: Record<string, unknown> }).data
    expect(payload).not.toHaveProperty('isCompleted')
    expect(payload).not.toHaveProperty('isArchived')
    expect(payload).not.toHaveProperty('journeyGalleryEnabled')
    expect(payload).not.toHaveProperty('resultGalleryEnabled')
    expect(payload).not.toHaveProperty('gallerySlug')
    expect(payload).not.toHaveProperty('resultStepId')
  })

  it('resets every cloned step to NOT_STARTED, previousState=null, excludeFromGallery=false', async () => {
    const tx = buildTx({
      source: {
        id: validProjectId,
        name: 'Knife',
        description: null,
        hobbyId: 'hobby-1',
        isCompleted: false,
        isArchived: false,
        steps: [
          { id: 'a', name: 'S1', sortOrder: 0, state: 'COMPLETED' },
          { id: 'b', name: 'S2', sortOrder: 1, state: 'IN_PROGRESS' },
          { id: 'c', name: 'S3', sortOrder: 2, state: 'BLOCKED' },
        ],
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await cloneProject(validProjectId)

    const payload = (
      tx.project.create.mock.calls[0][0] as {
        data: { steps: { create: Array<Record<string, unknown>> } }
      }
    ).data
    const stepsPayload = payload.steps.create

    expect(stepsPayload).toHaveLength(3)
    for (const [i, s] of stepsPayload.entries()) {
      expect(s.name).toBe(['S1', 'S2', 'S3'][i])
      expect(s.sortOrder).toBe(i)
      expect(s.state).toBe('NOT_STARTED')
      expect(s.previousState).toBeNull()
      expect(s.excludeFromGallery).toBe(false)
    }
  })

  it('does NOT create notes, blockers, or images on the clone', async () => {
    const tx = buildTx({
      source: {
        id: validProjectId,
        name: 'Knife',
        description: null,
        hobbyId: 'hobby-1',
        isCompleted: false,
        isArchived: false,
        steps: [{ id: 'a', name: 'S1', sortOrder: 0, state: 'COMPLETED' }],
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await cloneProject(validProjectId)

    expect(tx.stepNote.create).not.toHaveBeenCalled()
    expect(tx.blocker.create).not.toHaveBeenCalled()
    expect(tx.stepImage.create).not.toHaveBeenCalled()
  })

  it('resolves next "(copy N)" when prior copies exist', async () => {
    const tx = buildTx({
      source: {
        id: validProjectId,
        name: 'Knife',
        description: null,
        hobbyId: 'hobby-1',
        isCompleted: false,
        isArchived: false,
        steps: [],
      },
      existingNames: ['Knife (copy)', 'Knife (copy 2)'],
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await cloneProject(validProjectId)

    const payload = (tx.project.create.mock.calls[0][0] as { data: { name: string } }).data
    expect(payload.name).toBe('Knife (copy 3)')
  })

  it('allows cloning a completed source', async () => {
    const tx = buildTx({
      source: {
        id: validProjectId,
        name: 'Finished Knife',
        description: null,
        hobbyId: 'hobby-1',
        isCompleted: true,
        isArchived: false,
        steps: [],
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await cloneProject(validProjectId)
    expect(result.success).toBe(true)
  })

  it('allows cloning an archived source', async () => {
    const tx = buildTx({
      source: {
        id: validProjectId,
        name: 'Old Knife',
        description: null,
        hobbyId: 'hobby-1',
        isCompleted: false,
        isArchived: true,
        steps: [],
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await cloneProject(validProjectId)
    expect(result.success).toBe(true)
  })

  it('revalidates the hobby page and dashboard after success', async () => {
    const tx = buildTx({
      source: {
        id: validProjectId,
        name: 'Knife',
        description: null,
        hobbyId: 'hobby-42',
        isCompleted: false,
        isArchived: false,
        steps: [],
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await cloneProject(validProjectId)

    expect(mockRevalidatePath).toHaveBeenCalledWith('/hobbies/hobby-42')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })

  it('returns spec-mandated error message on unexpected failure', async () => {
    mockTransaction.mockRejectedValue(new Error('db exploded'))

    const result = await cloneProject(validProjectId)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Clone failed — try again')
  })

  it('clones BOM rows with consumptionState reset and timestamps cleared (Story 16.5)', async () => {
    const tx = buildTx({
      source: {
        id: validProjectId,
        name: 'Knife',
        description: null,
        hobbyId: 'hobby-1',
        isCompleted: false,
        isArchived: false,
        steps: [],
        bomItems: [
          {
            inventoryItemId: 'inv-a',
            label: null,
            requiredQuantity: 100,
            unit: 'g',
            sortOrder: 0,
            consumptionState: 'NOT_CONSUMED',
          },
          {
            inventoryItemId: 'inv-b',
            label: null,
            requiredQuantity: 50,
            unit: 'g',
            sortOrder: 1,
            consumptionState: 'CONSUMED',
          },
          {
            inventoryItemId: null,
            label: 'Free-form clay',
            requiredQuantity: 5,
            unit: 'kg',
            sortOrder: 2,
            consumptionState: 'NOT_CONSUMED',
          },
        ],
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await cloneProject(validProjectId)

    const projectPayload = (
      tx.project.create.mock.calls[0][0] as {
        data: { bomItems: { create: Array<Record<string, unknown>> } }
      }
    ).data

    expect(projectPayload.bomItems.create).toHaveLength(3)
    for (const cloned of projectPayload.bomItems.create) {
      expect(cloned.consumptionState).toBe('NOT_CONSUMED')
      // Consumption timestamps must NOT appear on the clone payload
      expect(cloned).not.toHaveProperty('consumedAt')
      expect(cloned).not.toHaveProperty('unconsumedAt')
    }
    // Preserved fields pass through
    expect(projectPayload.bomItems.create[0]).toMatchObject({
      inventoryItemId: 'inv-a',
      requiredQuantity: 100,
      unit: 'g',
      sortOrder: 0,
    })
    expect(projectPayload.bomItems.create[2]).toMatchObject({
      inventoryItemId: null,
      label: 'Free-form clay',
      requiredQuantity: 5,
      unit: 'kg',
      sortOrder: 2,
    })
  })

  it('clones a project with zero BOM rows without error', async () => {
    const tx = buildTx({
      source: {
        id: validProjectId,
        name: 'Knife',
        description: null,
        hobbyId: 'hobby-1',
        isCompleted: false,
        isArchived: false,
        steps: [],
        bomItems: [],
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await cloneProject(validProjectId)
    expect(result.success).toBe(true)
    const projectPayload = (
      tx.project.create.mock.calls[0][0] as {
        data: { bomItems: { create: Array<unknown> } }
      }
    ).data
    expect(projectPayload.bomItems.create).toEqual([])
  })
})
