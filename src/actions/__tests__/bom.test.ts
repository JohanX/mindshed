import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    bomItem: { findMany: vi.fn() },
    $transaction: vi.fn(),
    blocker: { findFirst: vi.fn(), create: vi.fn() },
    step: { findFirst: vi.fn(), update: vi.fn() },
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
  createShortageBlockers,
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
  existing?: { projectId: string; inventoryItemId: string | null; project: { hobbyId: string } } | null
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
      findMany: vi.fn(async () =>
        (opts.existingInventoryNames ?? []).map((name) => ({ name })),
      ),
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

  it('rejects zero or negative requiredQuantity', async () => {
    let r = await addBomItem({ projectId: PROJECT_ID, label: 'X', requiredQuantity: 0 })
    expect(r.success).toBe(false)
    r = await addBomItem({ projectId: PROJECT_ID, label: 'X', requiredQuantity: -5 })
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
// createShortageBlockers — Story 16.4
// ========================================================================

type ShortageTxMock = {
  project: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  step: {
    findFirst: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  bomItem: {
    findMany: ReturnType<typeof vi.fn>
  }
  blocker: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

type ShortageBomRow = {
  id: string
  label: string | null
  requiredQuantity: number
  unit: string | null
  sortOrder: number
  consumptionState: 'NOT_CONSUMED' | 'CONSUMED' | 'UNDONE'
  inventoryItem: {
    id: string
    name: string
    type: 'MATERIAL' | 'CONSUMABLE' | 'TOOL'
    quantity: number | null
    isDeleted: boolean
  } | null
}

function buildShortageTx(opts: {
  project?: { hobbyId: string; isCompleted: boolean } | null
  step?: { id: string; name: string; state: string; previousState: string | null } | null
  bomRows?: ShortageBomRow[]
  existingBlockerIds?: Set<string> // inventoryItemIds that already have unresolved blockers
}): ShortageTxMock {
  const existingSet = opts.existingBlockerIds ?? new Set<string>()
  return {
    project: {
      findUnique: vi.fn(async () =>
        opts.project !== undefined ? opts.project : { hobbyId: HOBBY_ID, isCompleted: false },
      ),
      update: vi.fn(async () => ({ id: PROJECT_ID })),
    },
    step: {
      findFirst: vi.fn(async () =>
        opts.step !== undefined
          ? opts.step
          : { id: 'step-1', name: 'Prep', state: 'NOT_STARTED', previousState: null },
      ),
      update: vi.fn(async () => ({ id: 'step-1' })),
    },
    bomItem: {
      findMany: vi.fn(async () => opts.bomRows ?? []),
    },
    blocker: {
      findFirst: vi.fn(async (args: unknown) => {
        const where = (args as { where: { inventoryItemId: string } }).where
        return existingSet.has(where.inventoryItemId) ? { id: 'existing' } : null
      }),
      create: vi.fn(async () => ({ id: 'new-blocker' })),
    },
  }
}

function shortRow(
  id: string,
  inventoryItemId: string,
  name: string,
  required: number,
  available: number,
  unit: string | null = 'g',
): ShortageBomRow {
  return {
    id,
    label: null,
    requiredQuantity: required,
    unit,
    sortOrder: 0,
    consumptionState: 'NOT_CONSUMED',
    inventoryItem: {
      id: inventoryItemId,
      name,
      type: 'MATERIAL',
      quantity: available,
      isDeleted: false,
    },
  }
}

describe('createShortageBlockers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid UUID before entering transaction', async () => {
    const result = await createShortageBlockers({ projectId: 'bad' } as never)
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns "Add a step before creating blockers" when project has zero steps', async () => {
    const tx = buildShortageTx({ step: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createShortageBlockers({ projectId: PROJECT_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Add a step before creating blockers')
  })

  it('returns "Project not found." when project does not exist', async () => {
    const tx = buildShortageTx({ project: null })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createShortageBlockers({ projectId: PROJECT_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Project not found.')
  })

  it('returns "Cannot add blockers to a completed project." when isCompleted', async () => {
    const tx = buildShortageTx({ project: { hobbyId: HOBBY_ID, isCompleted: true } })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createShortageBlockers({ projectId: PROJECT_ID })
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error).toBe('Cannot add blockers to a completed project.')
  })

  it('returns "Cannot block a completed step." when the first step is completed', async () => {
    const tx = buildShortageTx({
      step: { id: 'step-1', name: 'Done', state: 'COMPLETED', previousState: null },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createShortageBlockers({ projectId: PROJECT_ID })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Cannot block a completed step.')
  })

  it('creates one blocker per shortage with correct description template', async () => {
    const tx = buildShortageTx({
      bomRows: [
        shortRow('b1', 'inv-1', 'Kaolin', 500, 100, 'g'),
        shortRow('b2', 'inv-2', 'Silica', 200, 50, 'g'),
        // sufficient row — should NOT create a blocker
        { ...shortRow('b3', 'inv-3', 'Feldspar', 50, 500, 'g') },
      ],
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createShortageBlockers({ projectId: PROJECT_ID })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.created).toBe(2)
      expect(result.data.skipped).toBe(0)
      expect(result.data.stepName).toBe('Prep')
    }

    expect(tx.blocker.create).toHaveBeenCalledTimes(2)
    const first = tx.blocker.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(first.data).toEqual({
      stepId: 'step-1',
      inventoryItemId: 'inv-1',
      description: 'Need 500 g of Kaolin (have 100)',
      isResolved: false,
    })
    const second = tx.blocker.create.mock.calls[1][0] as { data: Record<string, unknown> }
    expect(second.data.description).toBe('Need 200 g of Silica (have 50)')
  })

  it('skips shortages that already have an unresolved blocker on the same step', async () => {
    const tx = buildShortageTx({
      bomRows: [
        shortRow('b1', 'inv-1', 'Kaolin', 500, 100),
        shortRow('b2', 'inv-2', 'Silica', 200, 50),
      ],
      existingBlockerIds: new Set(['inv-1']),
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createShortageBlockers({ projectId: PROJECT_ID })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.created).toBe(1)
      expect(result.data.skipped).toBe(1)
    }
    expect(tx.blocker.create).toHaveBeenCalledTimes(1)
    const payload = tx.blocker.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(payload.data.inventoryItemId).toBe('inv-2')
  })

  it('all shortages already blocked → created=0, skipped=N, no state transition', async () => {
    const tx = buildShortageTx({
      bomRows: [
        shortRow('b1', 'inv-1', 'Kaolin', 500, 100),
        shortRow('b2', 'inv-2', 'Silica', 200, 50),
      ],
      existingBlockerIds: new Set(['inv-1', 'inv-2']),
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createShortageBlockers({ projectId: PROJECT_ID })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.created).toBe(0)
      expect(result.data.skipped).toBe(2)
    }
    // Step state must NOT change when no blockers are created
    expect(tx.step.update).not.toHaveBeenCalled()
    expect(tx.blocker.create).not.toHaveBeenCalled()
  })

  it('cascades step state NOT_STARTED → BLOCKED with previousState on first blocker', async () => {
    const tx = buildShortageTx({
      step: { id: 'step-1', name: 'Prep', state: 'NOT_STARTED', previousState: null },
      bomRows: [shortRow('b1', 'inv-1', 'Kaolin', 500, 100)],
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await createShortageBlockers({ projectId: PROJECT_ID })
    expect(tx.step.update).toHaveBeenCalledOnce()
    const payload = tx.step.update.mock.calls[0][0] as {
      data: { state: string; previousState: string }
    }
    expect(payload.data.state).toBe('BLOCKED')
    expect(payload.data.previousState).toBe('NOT_STARTED')
  })

  it('does not overwrite step state when step was already BLOCKED', async () => {
    const tx = buildShortageTx({
      step: { id: 'step-1', name: 'Prep', state: 'BLOCKED', previousState: 'IN_PROGRESS' },
      bomRows: [shortRow('b1', 'inv-1', 'Kaolin', 500, 100)],
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await createShortageBlockers({ projectId: PROJECT_ID })
    expect(tx.step.update).not.toHaveBeenCalled()
  })

  it('bumps lastActivityAt even when no new blockers were created', async () => {
    const tx = buildShortageTx({ bomRows: [] })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await createShortageBlockers({ projectId: PROJECT_ID })
    expect(tx.project.update).toHaveBeenCalledOnce()
    const payload = tx.project.update.mock.calls[0][0] as {
      data: { lastActivityAt: Date }
    }
    expect(payload.data.lastActivityAt).toBeInstanceOf(Date)
  })

  it('description omits unit when row.unit is null', async () => {
    const tx = buildShortageTx({
      bomRows: [shortRow('b1', 'inv-1', 'Wheel', 1, 0, null)],
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await createShortageBlockers({ projectId: PROJECT_ID })
    const payload = tx.blocker.create.mock.calls[0][0] as { data: { description: string } }
    expect(payload.data.description).toBe('Need 1 of Wheel (have 0)')
  })

  it('revalidates all affected routes on success', async () => {
    const tx = buildShortageTx({
      bomRows: [shortRow('b1', 'inv-1', 'Kaolin', 500, 100)],
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await createShortageBlockers({ projectId: PROJECT_ID })
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hobbies/${HOBBY_ID}/projects/${PROJECT_ID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hobbies/${HOBBY_ID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/')
  })
})


