import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    bomItem: { findMany: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
    blocker: { findFirst: vi.fn(), create: vi.fn() },
    step: { findUnique: vi.fn(), update: vi.fn() },
    inventoryItem: { update: vi.fn() },
    project: { update: vi.fn() },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  addBomItem,
  updateBomItem,
  deleteBomItem,
  getBomItemsByProject,
  addBomItemWithNewInventory,
  createBomShortageBlocker,
  markBomItemConsumed,
  undoBomItemConsumption,
} from '../bom'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const mockTransaction = vi.mocked(prisma.$transaction)
const mockFindMany = vi.mocked(prisma.bomItem.findMany)
const mockRevalidatePath = vi.mocked(revalidatePath)

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000'
const INVENTORY_ID = '550e8400-e29b-41d4-a716-446655440001'
const BOM_ITEM_ID = '550e8400-e29b-41d4-a716-446655440002'
const HOBBY_ID = '550e8400-e29b-41d4-a716-446655440003'

type TxMock = {
  project: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  inventoryItem: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  bomItem: {
    aggregate: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

function buildTx(opts: {
  project?: { hobbyId: string } | null
  inventoryItem?: { isDeleted: boolean } | null
  existingInventoryNames?: string[]
  inventoryCreateResult?: { id: string; unit: string | null }
  inventoryCreateError?: Error | { code: string }
  maxSortOrder?: number | null
  createResult?: { id: string }
  createError?: Error | { code: string }
  existing?: {
    projectId: string
    inventoryItemId: string | null
    project: { hobbyId: string }
  } | null
  updateError?: Error | { code: string }
  deleteError?: Error | { code: string }
}): TxMock {
  return {
    project: {
      findUnique: vi.fn(async () =>
        opts.project !== undefined ? opts.project : { hobbyId: HOBBY_ID },
      ),
      update: vi.fn(async () => ({ id: PROJECT_ID })),
    },
    inventoryItem: {
      findUnique: vi.fn(async () =>
        opts.inventoryItem !== undefined ? opts.inventoryItem : { isDeleted: false },
      ),
      findMany: vi.fn(async () => (opts.existingInventoryNames ?? []).map((name) => ({ name }))),
      create: vi.fn(async () => {
        if (opts.inventoryCreateError) throw opts.inventoryCreateError
        return opts.inventoryCreateResult ?? { id: 'new-inv-id', unit: null }
      }),
    },
    bomItem: {
      aggregate: vi.fn(async () => ({
        _max: { sortOrder: opts.maxSortOrder ?? null },
      })),
      create: vi.fn(async () => {
        if (opts.createError) throw opts.createError
        return opts.createResult ?? { id: BOM_ITEM_ID }
      }),
      findUnique: vi.fn(async () =>
        opts.existing !== undefined
          ? opts.existing
          : {
              projectId: PROJECT_ID,
              inventoryItemId: null,
              project: { hobbyId: HOBBY_ID },
            },
      ),
      update: vi.fn(async () => {
        if (opts.updateError) throw opts.updateError
        return { id: BOM_ITEM_ID }
      }),
      delete: vi.fn(async () => {
        if (opts.deleteError) throw opts.deleteError
        return { id: BOM_ITEM_ID }
      }),
    },
  }
}

describe('addBomItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects when neither label nor inventoryItemId is provided', async () => {
    const result = await addBomItem({
      projectId: PROJECT_ID,
      requiredQuantity: 100,
    } as never)
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('rejects when both label and inventoryItemId are provided', async () => {
    const result = await addBomItem({
      projectId: PROJECT_ID,
      label: 'Kaolin',
      inventoryItemId: INVENTORY_ID,
      requiredQuantity: 100,
    })
    expect(result.success).toBe(false)
  })

  it('accepts zero requiredQuantity (combobox-pick creates rows at 0; user edits in-row)', async () => {
    const tx = buildTx({ maxSortOrder: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))
    const r = await addBomItem({ projectId: PROJECT_ID, label: 'X', requiredQuantity: 0 })
    expect(r.success).toBe(true)
  })

  it('rejects negative requiredQuantity', async () => {
    const r = await addBomItem({ projectId: PROJECT_ID, label: 'X', requiredQuantity: -5 })
    expect(r.success).toBe(false)
  })

  it('creates a free-form BOM row with label and bumps lastActivityAt', async () => {
    const tx = buildTx({ maxSortOrder: 3 })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await addBomItem({
      projectId: PROJECT_ID,
      label: 'Clay',
      requiredQuantity: 500,
      unit: 'g',
    })

    expect(result.success).toBe(true)
    const payload = tx.bomItem.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(payload.data).toEqual({
      projectId: PROJECT_ID,
      inventoryItemId: null,
      label: 'Clay',
      requiredQuantity: 500,
      unit: 'g',
      sortOrder: 4,
    })
    // Inventory lookup should NOT run for free-form rows
    expect(tx.inventoryItem.findUnique).not.toHaveBeenCalled()
    // CLAUDE.md: every project-scoped mutation must bump lastActivityAt
    expect(tx.project.update).toHaveBeenCalledOnce()
    const projectPayload = tx.project.update.mock.calls[0][0] as {
      where: { id: string }
      data: { lastActivityAt: Date }
    }
    expect(projectPayload.where).toEqual({ id: PROJECT_ID })
    expect(projectPayload.data.lastActivityAt).toBeInstanceOf(Date)
  })

  it('creates an inventory-linked BOM row with sortOrder=0 when none exist', async () => {
    const tx = buildTx({ maxSortOrder: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await addBomItem({
      projectId: PROJECT_ID,
      inventoryItemId: INVENTORY_ID,
      requiredQuantity: 100,
    })

    expect(result.success).toBe(true)
    const payload = tx.bomItem.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(payload.data).toEqual({
      projectId: PROJECT_ID,
      inventoryItemId: INVENTORY_ID,
      label: null,
      requiredQuantity: 100,
      unit: null,
      sortOrder: 0,
    })
    expect(tx.inventoryItem.findUnique).toHaveBeenCalledOnce()
  })

  it('rejects when the referenced inventory item is soft-deleted', async () => {
    const tx = buildTx({ inventoryItem: { isDeleted: true } })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await addBomItem({
      projectId: PROJECT_ID,
      inventoryItemId: INVENTORY_ID,
      requiredQuantity: 100,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Inventory item not available.')
    expect(tx.bomItem.create).not.toHaveBeenCalled()
  })

  it('rejects when project does not exist', async () => {
    const tx = buildTx({ project: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await addBomItem({
      projectId: PROJECT_ID,
      label: 'Clay',
      requiredQuantity: 100,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Project not found.')
  })

  it('returns "already in this project" on P2002 partial-index collision', async () => {
    const tx = buildTx({ createError: { code: 'P2002' } })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await addBomItem({
      projectId: PROJECT_ID,
      inventoryItemId: INVENTORY_ID,
      requiredQuantity: 100,
    })

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toBe('This inventory item is already in this project.')
  })

  it('returns generic error on unexpected failure', async () => {
    mockTransaction.mockRejectedValue(new Error('boom'))
    const result = await addBomItem({
      projectId: PROJECT_ID,
      label: 'Clay',
      requiredQuantity: 1,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Failed to add BOM item.')
  })
})

describe('updateBomItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects when no editable fields are provided', async () => {
    const result = await updateBomItem({ id: BOM_ITEM_ID } as never)
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('rejects zero or negative requiredQuantity', async () => {
    const result = await updateBomItem({ id: BOM_ITEM_ID, requiredQuantity: 0 })
    expect(result.success).toBe(false)
  })

  it('persists only the provided fields and bumps lastActivityAt on success', async () => {
    const tx = buildTx({})
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await updateBomItem({ id: BOM_ITEM_ID, requiredQuantity: 250 })

    const payload = tx.bomItem.update.mock.calls[0][0] as {
      where: { id: string }
      data: Record<string, unknown>
    }
    expect(payload.where).toEqual({ id: BOM_ITEM_ID })
    expect(payload.data.requiredQuantity).toBe(250)
    expect(Object.keys(payload.data)).not.toContain('unit')
    expect(Object.keys(payload.data)).not.toContain('label')

    // lastActivityAt must be refreshed — project.update called with now() date
    expect(tx.project.update).toHaveBeenCalledOnce()
    const projectPayload = tx.project.update.mock.calls[0][0] as {
      where: { id: string }
      data: { lastActivityAt: Date }
    }
    expect(projectPayload.where).toEqual({ id: PROJECT_ID })
    expect(projectPayload.data.lastActivityAt).toBeInstanceOf(Date)
  })

  it('drops label writes on inventory-linked rows to prevent dead writes', async () => {
    const tx = buildTx({
      existing: {
        projectId: PROJECT_ID,
        inventoryItemId: INVENTORY_ID,
        project: { hobbyId: HOBBY_ID },
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await updateBomItem({ id: BOM_ITEM_ID, label: 'Should not stick' })

    const payload = tx.bomItem.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(payload.data).not.toHaveProperty('label')
  })

  it('keeps label writes on free-form rows', async () => {
    const tx = buildTx({
      existing: {
        projectId: PROJECT_ID,
        inventoryItemId: null,
        project: { hobbyId: HOBBY_ID },
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await updateBomItem({ id: BOM_ITEM_ID, label: 'Renamed' })

    const payload = tx.bomItem.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(payload.data.label).toBe('Renamed')
  })

  it('accepts null unit to clear the column', async () => {
    const tx = buildTx({})
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await updateBomItem({ id: BOM_ITEM_ID, unit: null })

    const payload = tx.bomItem.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(payload.data).toEqual({ unit: null })
  })

  it('returns "BOM item not found." when target does not exist', async () => {
    const tx = buildTx({ existing: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await updateBomItem({ id: BOM_ITEM_ID, requiredQuantity: 1 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('BOM item not found.')
  })
})

describe('deleteBomItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an invalid UUID before entering the transaction', async () => {
    const result = await deleteBomItem('not-a-uuid')
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('deletes the BOM row, bumps lastActivityAt, and leaves inventory untouched', async () => {
    const tx = buildTx({})
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await deleteBomItem(BOM_ITEM_ID)
    expect(result.success).toBe(true)
    expect(tx.bomItem.delete).toHaveBeenCalledWith({ where: { id: BOM_ITEM_ID } })
    // Inventory is NEVER modified by deleteBomItem
    expect(tx.inventoryItem.findUnique).not.toHaveBeenCalled()
    // lastActivityAt must be refreshed
    expect(tx.project.update).toHaveBeenCalledOnce()
  })

  it('returns "BOM item not found." when target is missing', async () => {
    const tx = buildTx({ existing: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await deleteBomItem(BOM_ITEM_ID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('BOM item not found.')
  })
})

describe('getBomItemsByProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an invalid UUID', async () => {
    const result = await getBomItemsByProject('bad')
    expect(result.success).toBe(false)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('queries with the correct where + orderBy + include shape', async () => {
    mockFindMany.mockResolvedValue([] as never)
    await getBomItemsByProject(PROJECT_ID)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: PROJECT_ID },
        orderBy: { sortOrder: 'asc' },
        include: {
          inventoryItem: {
            select: { id: true, name: true, type: true, quantity: true, isDeleted: true },
          },
        },
      }),
    )
  })

  it('maps rows to BomItemData shape', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'b1',
        label: 'Clay',
        requiredQuantity: 500,
        unit: 'g',
        sortOrder: 0,
        consumptionState: 'NOT_CONSUMED',
        inventoryItem: null,
      },
    ] as never)

    const result = await getBomItemsByProject(PROJECT_ID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0]).toEqual({
        id: 'b1',
        label: 'Clay',
        requiredQuantity: 500,
        unit: 'g',
        sortOrder: 0,
        consumptionState: 'NOT_CONSUMED',
        inventoryItem: null,
      })
    }
  })
})

describe('addBomItemWithNewInventory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty name', async () => {
    const result = await addBomItemWithNewInventory({
      projectId: PROJECT_ID,
      newItem: { name: '', type: 'MATERIAL' },
      requiredQuantity: 10,
    })
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('rejects missing requiredQuantity', async () => {
    const result = await addBomItemWithNewInventory({
      projectId: PROJECT_ID,
      newItem: { name: 'X', type: 'MATERIAL' },
    } as never)
    expect(result.success).toBe(false)
  })

  it('rejects negative startingQuantity', async () => {
    const result = await addBomItemWithNewInventory({
      projectId: PROJECT_ID,
      newItem: { name: 'X', type: 'MATERIAL', startingQuantity: -1 },
      requiredQuantity: 10,
    })
    expect(result.success).toBe(false)
  })

  it('creates inventory item and BOM row in one transaction', async () => {
    const tx = buildTx({
      existingInventoryNames: [],
      inventoryCreateResult: { id: 'inv-1', unit: 'g' },
      maxSortOrder: null,
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await addBomItemWithNewInventory({
      projectId: PROJECT_ID,
      newItem: { name: 'Kaolin', type: 'MATERIAL', startingQuantity: 0, unit: 'g' },
      requiredQuantity: 500,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.inventoryItemId).toBe('inv-1')
      expect(result.data.finalName).toBe('Kaolin')
    }

    const invPayload = tx.inventoryItem.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(invPayload.data).toEqual({
      name: 'Kaolin',
      type: 'MATERIAL',
      quantity: 0,
      unit: 'g',
    })

    const bomPayload = tx.bomItem.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(bomPayload.data).toEqual({
      projectId: PROJECT_ID,
      inventoryItemId: 'inv-1',
      label: null,
      requiredQuantity: 500,
      unit: 'g',
      sortOrder: 0,
    })

    expect(tx.project.update).toHaveBeenCalledOnce()
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hobbies/${HOBBY_ID}/projects/${PROJECT_ID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/inventory')
  })

  it('auto-renames on inventory name collision via nextUniqueInventoryName', async () => {
    const tx = buildTx({
      existingInventoryNames: ['Kaolin'],
      inventoryCreateResult: { id: 'inv-2', unit: null },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await addBomItemWithNewInventory({
      projectId: PROJECT_ID,
      newItem: { name: 'kaolin', type: 'MATERIAL' },
      requiredQuantity: 100,
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.finalName).toBe('kaolin (1)')
    const invPayload = tx.inventoryItem.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(invPayload.data.name).toBe('kaolin (1)')
  })

  it('inherits unit from inventory when BOM unit not provided', async () => {
    const tx = buildTx({
      inventoryCreateResult: { id: 'inv-3', unit: 'kg' },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await addBomItemWithNewInventory({
      projectId: PROJECT_ID,
      newItem: { name: 'Clay', type: 'MATERIAL', unit: 'kg' },
      requiredQuantity: 5,
    })

    const bomPayload = tx.bomItem.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(bomPayload.data.unit).toBe('kg')
  })

  it('BOM-level unit overrides inventory unit when both supplied', async () => {
    const tx = buildTx({
      inventoryCreateResult: { id: 'inv-4', unit: 'kg' },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await addBomItemWithNewInventory({
      projectId: PROJECT_ID,
      newItem: { name: 'Clay', type: 'MATERIAL', unit: 'kg' },
      requiredQuantity: 500,
      unit: 'g',
    })

    const bomPayload = tx.bomItem.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(bomPayload.data.unit).toBe('g')
  })

  it('returns Project not found when target project is missing', async () => {
    const tx = buildTx({ project: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await addBomItemWithNewInventory({
      projectId: PROJECT_ID,
      newItem: { name: 'Clay', type: 'MATERIAL' },
      requiredQuantity: 10,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Project not found.')
  })

  it('returns Item name collided on inventory P2002 race', async () => {
    const tx = buildTx({
      inventoryCreateError: { code: 'P2002' },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await addBomItemWithNewInventory({
      projectId: PROJECT_ID,
      newItem: { name: 'Clay', type: 'MATERIAL' },
      requiredQuantity: 10,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item name collided — please retry.')
  })
})

// ========================================================================
// createBomShortageBlocker — Story 17.1 (per-row + step picker)
// ========================================================================

const STEP_ID = '550e8400-e29b-41d4-a716-446655440010'

type PerRowTxMock = {
  bomItem: { findUnique: ReturnType<typeof vi.fn> }
  step: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  blocker: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
  project: { update: ReturnType<typeof vi.fn> }
}

type PerRowBomRow = {
  id: string
  requiredQuantity: number
  unit: string | null
  projectId: string
  consumptionState: 'NOT_CONSUMED' | 'CONSUMED' | 'UNDONE'
  label: string | null
  sortOrder: number
  inventoryItem: {
    id: string
    name: string
    type: 'MATERIAL' | 'CONSUMABLE' | 'TOOL'
    quantity: number | null
    isDeleted: boolean
  } | null
  project: { hobbyId: string }
}

function buildPerRowTx(opts: {
  row?: PerRowBomRow | null
  step?: { id: string; name: string; state: string; projectId: string } | null
  existingBlockerId?: string | null
}): PerRowTxMock {
  return {
    bomItem: {
      findUnique: vi.fn(async () => (opts.row === null ? null : (opts.row ?? defaultRow()))),
    },
    step: {
      findUnique: vi.fn(async () =>
        opts.step === null
          ? null
          : (opts.step ?? {
              id: STEP_ID,
              name: 'Prep',
              state: 'NOT_STARTED',
              projectId: PROJECT_ID,
            }),
      ),
      update: vi.fn(async () => ({ id: STEP_ID })),
    },
    blocker: {
      findFirst: vi.fn(async () =>
        opts.existingBlockerId ? { id: opts.existingBlockerId } : null,
      ),
      create: vi.fn(async () => ({ id: 'new-blocker' })),
    },
    project: { update: vi.fn(async () => ({ id: PROJECT_ID })) },
  }
}

function defaultRow(): PerRowBomRow {
  return {
    id: BOM_ITEM_ID,
    requiredQuantity: 500,
    unit: 'g',
    projectId: PROJECT_ID,
    consumptionState: 'NOT_CONSUMED',
    label: null,
    sortOrder: 0,
    inventoryItem: {
      id: INVENTORY_ID,
      name: 'Kaolin',
      type: 'MATERIAL',
      quantity: 100,
      isDeleted: false,
    },
    project: { hobbyId: HOBBY_ID },
  }
}

describe('createBomShortageBlocker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid UUIDs before transaction', async () => {
    const result = await createBomShortageBlocker({
      bomItemId: 'bad',
      stepId: STEP_ID,
    } as never)
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('happy path — creates blocker, cascades step to BLOCKED, bumps activity', async () => {
    const tx = buildPerRowTx({})
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.alreadyExisted).toBe(false)
      expect(result.data.stepName).toBe('Prep')
    }
    expect(tx.blocker.create).toHaveBeenCalledOnce()
    const payload = tx.blocker.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(payload.data).toEqual({
      stepId: STEP_ID,
      inventoryItemId: INVENTORY_ID,
      description: 'Need 500 g of Kaolin (have 100)',
    })
    expect(tx.step.update).toHaveBeenCalledOnce()
    const stepPayload = tx.step.update.mock.calls[0][0] as {
      data: { state: string; previousState: string }
    }
    expect(stepPayload.data.state).toBe('BLOCKED')
    expect(stepPayload.data.previousState).toBe('NOT_STARTED')
    expect(tx.project.update).toHaveBeenCalledOnce()
  })

  it('dedup — existing unresolved blocker → alreadyExisted=true, no create/update', async () => {
    const tx = buildPerRowTx({ existingBlockerId: 'existing-blocker' })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.alreadyExisted).toBe(true)
      expect(result.data.blockerId).toBe('existing-blocker')
    }
    expect(tx.blocker.create).not.toHaveBeenCalled()
    expect(tx.step.update).not.toHaveBeenCalled()
    expect(tx.project.update).not.toHaveBeenCalled()
  })

  it('race — blocker.create throws P2002 → outer retry hits dedup and returns alreadyExisted (Story 18.1)', async () => {
    // Simulate: first tx has findFirst → null, create → P2002 (raced); outer
    // catch retries with a fresh tx; second tx's findFirst sees the raced
    // blocker (now committed) and returns alreadyExisted=true.
    // The failed statement poisons the PG tx so in-tx re-query is unsafe —
    // this test asserts the outer-retry contract.
    const firstTx = buildPerRowTx({})
    firstTx.blocker.create = vi.fn(async () => {
      throw Object.assign(new Error('Unique constraint violated'), { code: 'P2002' })
    })
    const secondTx = buildPerRowTx({ existingBlockerId: 'raced-blocker' })
    let txCall = 0
    mockTransaction.mockImplementation(async (fn) => {
      txCall += 1
      return fn((txCall === 1 ? firstTx : secondTx) as never)
    })

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.alreadyExisted).toBe(true)
      expect(result.data.blockerId).toBe('raced-blocker')
    }
    // Both txs were entered; second resolved via dedup findFirst.
    expect(txCall).toBe(2)
    expect(secondTx.step.update).not.toHaveBeenCalled()
    expect(secondTx.project.update).not.toHaveBeenCalled()
  })

  it('rejects NOT_SHORT when required <= available', async () => {
    const tx = buildPerRowTx({
      row: { ...defaultRow(), requiredQuantity: 50 },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('This row is no longer short — reload.')
    expect(tx.blocker.create).not.toHaveBeenCalled()
  })

  it('rejects when BOM row is already CONSUMED', async () => {
    const tx = buildPerRowTx({
      row: { ...defaultRow(), consumptionState: 'CONSUMED' },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('This row is no longer short — reload.')
  })

  it('rejects when inventoryItem is null (free-form row)', async () => {
    const tx = buildPerRowTx({
      row: { ...defaultRow(), inventoryItem: null },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Cannot create blocker for this row.')
  })

  it('rejects when linked inventory is soft-deleted', async () => {
    const row = defaultRow()
    const tx = buildPerRowTx({
      row: { ...row, inventoryItem: { ...row.inventoryItem!, isDeleted: true } },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Cannot create blocker for this row.')
  })

  it('rejects when BOM row not found', async () => {
    const tx = buildPerRowTx({ row: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('BOM item not found.')
  })

  it('rejects STEP_NOT_FOUND', async () => {
    const tx = buildPerRowTx({ step: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })

  it('rejects STEP_WRONG_PROJECT when step.projectId differs', async () => {
    const tx = buildPerRowTx({
      step: { id: STEP_ID, name: 'Other', state: 'NOT_STARTED', projectId: 'other-project' },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step does not belong to this project.')
  })

  it('rejects STEP_COMPLETED', async () => {
    const tx = buildPerRowTx({
      step: { id: STEP_ID, name: 'Done', state: 'COMPLETED', projectId: PROJECT_ID },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Cannot block a completed step.')
  })

  it('does not overwrite step state when already BLOCKED', async () => {
    const tx = buildPerRowTx({
      step: { id: STEP_ID, name: 'Prep', state: 'BLOCKED', projectId: PROJECT_ID },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(result.success).toBe(true)
    expect(tx.blocker.create).toHaveBeenCalledOnce()
    expect(tx.step.update).not.toHaveBeenCalled()
  })

  it('description omits unit when row.unit is null', async () => {
    const tx = buildPerRowTx({
      row: {
        ...defaultRow(),
        unit: null,
        requiredQuantity: 1,
        inventoryItem: { ...defaultRow().inventoryItem!, quantity: 0 },
      },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    const payload = tx.blocker.create.mock.calls[0][0] as { data: { description: string } }
    expect(payload.data.description).toBe('Need 1 of Kaolin (have 0)')
  })

  it('revalidates project + dashboard routes on success', async () => {
    const tx = buildPerRowTx({})
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await createBomShortageBlocker({
      bomItemId: BOM_ITEM_ID,
      stepId: STEP_ID,
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hobbies/${HOBBY_ID}/projects/${PROJECT_ID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hobbies/${HOBBY_ID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })
})

// ========================================================================
// markBomItemConsumed / undoBomItemConsumption — Story 16.5
// ========================================================================

type ConsumptionTxMock = {
  bomItem: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  inventoryItem: {
    update: ReturnType<typeof vi.fn>
  }
  project: {
    update: ReturnType<typeof vi.fn>
  }
}

function buildConsumptionTx(opts: {
  row?: {
    requiredQuantity: number
    consumptionState: 'NOT_CONSUMED' | 'CONSUMED' | 'UNDONE'
    projectId: string
    inventoryItem: {
      id: string
      name: string
      quantity: number | null
      isDeleted: boolean
      type: 'MATERIAL' | 'CONSUMABLE' | 'TOOL'
    } | null
    project: { hobbyId: string }
  } | null
}): ConsumptionTxMock {
  return {
    bomItem: {
      findUnique: vi.fn(async () => (opts.row !== undefined ? opts.row : null)),
      update: vi.fn(async () => ({ id: BOM_ITEM_ID })),
    },
    inventoryItem: {
      update: vi.fn(async () => ({ id: INVENTORY_ID })),
    },
    project: {
      update: vi.fn(async () => ({ id: PROJECT_ID })),
    },
  }
}

function materialRow(
  overrides: {
    required?: number
    available?: number | null
    state?: 'NOT_CONSUMED' | 'CONSUMED' | 'UNDONE'
    isDeleted?: boolean
    type?: 'MATERIAL' | 'CONSUMABLE' | 'TOOL'
    name?: string
  } = {},
) {
  return {
    requiredQuantity: overrides.required ?? 100,
    consumptionState: overrides.state ?? ('NOT_CONSUMED' as const),
    projectId: PROJECT_ID,
    inventoryItem: {
      id: INVENTORY_ID,
      name: overrides.name ?? 'Kaolin',
      // Honor explicit null via `in` check — `??` would coerce null to the fallback
      quantity: 'available' in overrides ? (overrides.available as number | null) : 500,
      isDeleted: overrides.isDeleted ?? false,
      type: overrides.type ?? ('MATERIAL' as const),
    },
    project: { hobbyId: HOBBY_ID },
  }
}

describe('markBomItemConsumed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid UUID before the transaction', async () => {
    const result = await markBomItemConsumed({ id: 'nope' } as never)
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('happy path: decrements inventory, flips to CONSUMED, bumps lastActivityAt', async () => {
    const tx = buildConsumptionTx({
      row: materialRow({ required: 100, available: 500 }),
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await markBomItemConsumed({ id: BOM_ITEM_ID })
    expect(result.success).toBe(true)

    const invCall = tx.inventoryItem.update.mock.calls[0][0] as {
      where: { id: string }
      data: { quantity: { decrement: number } }
    }
    expect(invCall.where.id).toBe(INVENTORY_ID)
    expect(invCall.data.quantity.decrement).toBe(100)

    const bomCall = tx.bomItem.update.mock.calls[0][0] as {
      data: { consumptionState: string; consumedAt: Date }
    }
    expect(bomCall.data.consumptionState).toBe('CONSUMED')
    expect(bomCall.data.consumedAt).toBeInstanceOf(Date)

    expect(tx.project.update).toHaveBeenCalledOnce()
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hobbies/${HOBBY_ID}/projects/${PROJECT_ID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/inventory')
  })

  it('rejects with interpolated toast when available < required', async () => {
    const tx = buildConsumptionTx({
      row: materialRow({ required: 100, available: 50, name: 'Silica' }),
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await markBomItemConsumed({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toBe('Not enough Silica in inventory. Create shortage blockers first.')
    expect(tx.inventoryItem.update).not.toHaveBeenCalled()
    expect(tx.bomItem.update).not.toHaveBeenCalled()
  })

  it('rejects when row already CONSUMED', async () => {
    const tx = buildConsumptionTx({
      row: materialRow({ state: 'CONSUMED', required: 10, available: 1000 }),
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await markBomItemConsumed({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Row already consumed or reverted.')
  })

  it('rejects when row is UNDONE', async () => {
    const tx = buildConsumptionTx({
      row: materialRow({ state: 'UNDONE', required: 10, available: 1000 }),
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await markBomItemConsumed({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
  })

  it('rejects CONSUMABLE type', async () => {
    const tx = buildConsumptionTx({ row: materialRow({ type: 'CONSUMABLE' }) })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await markBomItemConsumed({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Cannot mark this row as consumed.')
  })

  it('rejects TOOL type', async () => {
    const tx = buildConsumptionTx({ row: materialRow({ type: 'TOOL' }) })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await markBomItemConsumed({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
  })

  it('rejects soft-deleted inventory', async () => {
    const tx = buildConsumptionTx({
      row: materialRow({ isDeleted: true, required: 10, available: 1000 }),
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await markBomItemConsumed({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Cannot mark this row as consumed.')
  })

  it('rejects null inventory quantity as insufficient', async () => {
    const tx = buildConsumptionTx({
      row: materialRow({ available: null, name: 'Kaolin' }),
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await markBomItemConsumed({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Not enough Kaolin in inventory')
  })

  it('returns BOM item not found when row missing', async () => {
    const tx = buildConsumptionTx({ row: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await markBomItemConsumed({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('BOM item not found.')
  })
})

describe('undoBomItemConsumption', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid UUID before the transaction', async () => {
    const result = await undoBomItemConsumption({ id: 'nope' } as never)
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('happy path: credits inventory, flips to UNDONE, bumps lastActivityAt', async () => {
    const tx = buildConsumptionTx({
      row: materialRow({ state: 'CONSUMED', required: 100, available: 400 }),
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await undoBomItemConsumption({ id: BOM_ITEM_ID })
    expect(result.success).toBe(true)

    const invCall = tx.inventoryItem.update.mock.calls[0][0] as {
      data: { quantity: { increment: number } }
    }
    expect(invCall.data.quantity.increment).toBe(100)

    const bomCall = tx.bomItem.update.mock.calls[0][0] as {
      data: { consumptionState: string; unconsumedAt: Date }
    }
    expect(bomCall.data.consumptionState).toBe('UNDONE')
    expect(bomCall.data.unconsumedAt).toBeInstanceOf(Date)

    expect(mockRevalidatePath).toHaveBeenCalledWith('/inventory')
  })

  it('still credits inventory when the item is soft-deleted (AC #7)', async () => {
    const tx = buildConsumptionTx({
      row: materialRow({
        state: 'CONSUMED',
        required: 50,
        available: 10,
        isDeleted: true,
      }),
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await undoBomItemConsumption({ id: BOM_ITEM_ID })
    expect(result.success).toBe(true)
    expect(tx.inventoryItem.update).toHaveBeenCalledOnce()
  })

  it('rejects when row is NOT_CONSUMED', async () => {
    const tx = buildConsumptionTx({ row: materialRow({ state: 'NOT_CONSUMED' }) })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await undoBomItemConsumption({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Row is not in a consumed state.')
  })

  it('rejects when row is UNDONE (one-shot semantics)', async () => {
    const tx = buildConsumptionTx({ row: materialRow({ state: 'UNDONE' }) })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await undoBomItemConsumption({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
  })

  it('returns BOM item not found when row missing', async () => {
    const tx = buildConsumptionTx({ row: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await undoBomItemConsumption({ id: BOM_ITEM_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('BOM item not found.')
  })
})
