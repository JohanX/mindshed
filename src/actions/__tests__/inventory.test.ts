import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    inventoryItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import {
  createInventoryItem,
  getInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryItemOptions,
  getOverdueMaintenanceItems,
  recordMaintenance,
  updateMaintenanceData,
} from '../inventory'
import { prisma } from '@/lib/db'

const mockFindMany = vi.mocked(prisma.inventoryItem.findMany)
const mockFindUnique = vi.mocked(prisma.inventoryItem.findUnique)
const mockUpdate = vi.mocked(prisma.inventoryItem.update)
const mockTransaction = vi.mocked(prisma.$transaction)

const validId = '550e8400-e29b-41d4-a716-446655440000'

type TxMock = {
  inventoryItem: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  blocker: { updateMany: ReturnType<typeof vi.fn> }
}

function buildTx(opts: {
  existingNames?: string[]
  currentName?: string
  siblingNames?: string[]
  createResult?: { id: string }
  updateResult?: { id: string }
  createError?: Error | { code: string }
  updateError?: Error | { code: string }
}): TxMock {
  const siblingsFindMany = vi.fn()
  siblingsFindMany.mockImplementation(async (args) => {
    // updateInventoryItem queries siblings with `where.id.not` — return `siblingNames`.
    // createInventoryItem queries all active names — return `existingNames`.
    if (args?.where?.id?.not) {
      return (opts.siblingNames ?? []).map((name) => ({ name }))
    }
    return (opts.existingNames ?? []).map((name) => ({ name }))
  })

  return {
    inventoryItem: {
      findMany: siblingsFindMany,
      findUnique: vi.fn(async () =>
        opts.currentName !== undefined ? { name: opts.currentName } : null,
      ),
      create: vi.fn(async () => {
        if (opts.createError) throw opts.createError
        return opts.createResult ?? { id: 'i1' }
      }),
      update: vi.fn(async () => {
        if (opts.updateError) throw opts.updateError
        return opts.updateResult ?? { id: 'i1' }
      }),
      delete: vi.fn(),
    },
    blocker: { updateMany: vi.fn() },
  }
}

describe('createInventoryItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates item with no collision — name passes through unchanged', async () => {
    const tx = buildTx({ existingNames: [] })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createInventoryItem({
      name: 'Walnut lumber',
      type: 'MATERIAL',
      quantity: 5,
      unit: 'boards',
    })

    expect(result.success).toBe(true)
    expect(tx.inventoryItem.create).toHaveBeenCalledOnce()
    const payload = tx.inventoryItem.create.mock.calls[0][0] as { data: { name: string } }
    expect(payload.data.name).toBe('Walnut lumber')
  })

  it('auto-renames on case-insensitive collision: kaolin + [Kaolin] → kaolin (1)', async () => {
    const tx = buildTx({ existingNames: ['Kaolin'] })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await createInventoryItem({ name: 'kaolin', type: 'MATERIAL' })

    const payload = tx.inventoryItem.create.mock.calls[0][0] as { data: { name: string } }
    expect(payload.data.name).toBe('kaolin (1)')
  })

  it('validates required name', async () => {
    const result = await createInventoryItem({ name: '', type: 'MATERIAL' })
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('validates type enum', async () => {
    const result = await createInventoryItem({ name: 'Test', type: 'INVALID' as never })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', async () => {
    const result = await createInventoryItem({ name: 'Test', type: 'TOOL', quantity: -1 })
    expect(result.success).toBe(false)
  })

  it('returns P2002 fallback on unique-index race', async () => {
    const tx = buildTx({ existingNames: [], createError: { code: 'P2002' } })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await createInventoryItem({ name: 'Test', type: 'MATERIAL' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item name collided — please retry.')
  })

  it('returns generic error on other DB failures', async () => {
    mockTransaction.mockRejectedValue(new Error('DB error'))
    const result = await createInventoryItem({ name: 'Test', type: 'MATERIAL' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Failed to add item.')
  })

  it('connects hobbies when hobbyIds provided', async () => {
    const hobbyId1 = '550e8400-e29b-41d4-a716-446655440001'
    const hobbyId2 = '550e8400-e29b-41d4-a716-446655440002'
    const tx = buildTx({ existingNames: [] })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await createInventoryItem({
      name: 'Clay',
      type: 'MATERIAL',
      hobbyIds: [hobbyId1, hobbyId2],
    })

    const payload = tx.inventoryItem.create.mock.calls[0][0] as {
      data: { hobbies?: { connect: { id: string }[] } }
    }
    expect(payload.data.hobbies).toEqual({
      connect: [{ id: hobbyId1 }, { id: hobbyId2 }],
    })
  })

  it('omits hobbies connect when hobbyIds empty or absent', async () => {
    const tx = buildTx({ existingNames: [] })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await createInventoryItem({ name: 'Wire', type: 'MATERIAL', hobbyIds: [] })

    const payload = tx.inventoryItem.create.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(payload.data.hobbies).toBeUndefined()
  })
})

describe('getInventoryItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes { isDeleted: false } when no type filter', async () => {
    mockFindMany.mockResolvedValue([] as never)
    await getInventoryItems()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isDeleted: false } }),
    )
  })

  it('merges type filter into where with isDeleted: false', async () => {
    mockFindMany.mockResolvedValue([] as never)
    await getInventoryItems('TOOL')
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isDeleted: false, type: 'TOOL' } }),
    )
  })

  it('returns items with activeBlockerCount', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'i1', name: 'Item', _count: { blockers: 3 }, hobbies: [], images: [] },
    ] as never)
    const result = await getInventoryItems()
    expect(result.success).toBe(true)
    if (result.success) expect(result.data[0].activeBlockerCount).toBe(3)
  })
})

describe('updateInventoryItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates item preserving incoming name when case-insensitive match with self', async () => {
    const tx = buildTx({
      currentName: 'Kaolin',
      siblingNames: [],
      updateResult: { id: 'i1' },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await updateInventoryItem({
      id: validId,
      name: 'kaolin',
      type: 'MATERIAL',
    })

    expect(result.success).toBe(true)
    // The sibling findMany must NOT be called — rename logic skipped
    const siblingFindCalls = tx.inventoryItem.findMany.mock.calls.filter(
      (args) => (args[0] as { where?: { id?: { not: string } } })?.where?.id?.not,
    )
    expect(siblingFindCalls).toHaveLength(0)
    const payload = tx.inventoryItem.update.mock.calls[0][0] as { data: { name: string } }
    expect(payload.data.name).toBe('kaolin')
  })

  it('auto-renames when renaming into an existing sibling name', async () => {
    const tx = buildTx({
      currentName: 'Silica',
      siblingNames: ['Kaolin'],
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await updateInventoryItem({
      id: validId,
      name: 'kaolin',
      type: 'MATERIAL',
    })

    const payload = tx.inventoryItem.update.mock.calls[0][0] as { data: { name: string } }
    expect(payload.data.name).toBe('kaolin (1)')
  })

  it('returns "Item not found." when target row is missing', async () => {
    const tx = buildTx({ currentName: undefined })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await updateInventoryItem({
      id: validId,
      name: 'Anything',
      type: 'MATERIAL',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item not found.')
  })

  it('validates required name', async () => {
    const result = await updateInventoryItem({ id: validId, name: '', type: 'MATERIAL' })
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns P2002 fallback on unique-index race', async () => {
    const tx = buildTx({
      currentName: 'Silica',
      siblingNames: ['Kaolin'],
      updateError: { code: 'P2002' },
    })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await updateInventoryItem({
      id: validId,
      name: 'kaolin',
      type: 'MATERIAL',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item name collided — please retry.')
  })

  it('sets hobbies via replace-all semantics (set)', async () => {
    const hobbyId = '550e8400-e29b-41d4-a716-446655440001'
    const tx = buildTx({ currentName: 'Clay', siblingNames: [] })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await updateInventoryItem({
      id: validId,
      name: 'Clay',
      type: 'MATERIAL',
      hobbyIds: [hobbyId],
    })

    const payload = tx.inventoryItem.update.mock.calls[0][0] as {
      data: { hobbies?: { set: { id: string }[] } }
    }
    expect(payload.data.hobbies).toEqual({ set: [{ id: hobbyId }] })
  })

  it('clears hobbies when hobbyIds is empty array', async () => {
    const tx = buildTx({ currentName: 'Clay', siblingNames: [] })
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await updateInventoryItem({
      id: validId,
      name: 'Clay',
      type: 'MATERIAL',
      hobbyIds: [],
    })

    const payload = tx.inventoryItem.update.mock.calls[0][0] as {
      data: { hobbies?: { set: { id: string }[] } }
    }
    expect(payload.data.hobbies).toEqual({ set: [] })
  })
})

describe('deleteInventoryItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes by setting isDeleted=true and deletedAt=now()', async () => {
    const tx = buildTx({})
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    const result = await deleteInventoryItem(validId)
    expect(result.success).toBe(true)

    expect(tx.inventoryItem.update).toHaveBeenCalledOnce()
    const args = tx.inventoryItem.update.mock.calls[0][0] as {
      where: { id: string }
      data: { isDeleted: boolean; deletedAt: Date }
    }
    expect(args.where).toEqual({ id: validId })
    expect(args.data.isDeleted).toBe(true)
    expect(args.data.deletedAt).toBeInstanceOf(Date)
  })

  it('never hard-deletes the row', async () => {
    const tx = buildTx({})
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await deleteInventoryItem(validId)
    expect(tx.inventoryItem.delete).not.toHaveBeenCalled()
  })

  it('never nulls linked blocker FKs', async () => {
    const tx = buildTx({})
    mockTransaction.mockImplementation(async (fn) => fn(tx as never))

    await deleteInventoryItem(validId)
    expect(tx.blocker.updateMany).not.toHaveBeenCalled()
  })

  it('validates UUID input', async () => {
    const result = await deleteInventoryItem('bad-id')
    expect(result.success).toBe(false)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns "Item not found." on P2025', async () => {
    mockTransaction.mockRejectedValue({ code: 'P2025' })
    const result = await deleteInventoryItem(validId)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item not found.')
  })
})

describe('getInventoryItemOptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters soft-deleted items and selects quantity + unit (Story 16.3)', async () => {
    mockFindMany.mockResolvedValue([] as never)
    await getInventoryItemOptions()
    const callArg = mockFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>
      select: Record<string, unknown>
    }
    expect(callArg.where).toEqual({ isDeleted: false })
    expect(callArg.select).toEqual({
      id: true,
      name: true,
      type: true,
      quantity: true,
      unit: true,
    })
  })

  it('scopes to hobby-tagged + untagged items when hobbyId provided', async () => {
    const hobbyId = '550e8400-e29b-41d4-a716-446655440001'
    mockFindMany.mockResolvedValue([] as never)
    await getInventoryItemOptions(hobbyId)
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where).toEqual({
      isDeleted: false,
      OR: [{ hobbies: { some: { id: hobbyId } } }, { hobbies: { none: {} } }],
    })
  })

  it('rejects invalid hobbyId', async () => {
    const result = await getInventoryItemOptions('bad-id')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid hobby ID.')
    expect(mockFindMany).not.toHaveBeenCalled()
  })
})

describe('getOverdueMaintenanceItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters soft-deleted items alongside the TOOL type filter', async () => {
    mockFindMany.mockResolvedValue([] as never)
    await getOverdueMaintenanceItems()
    const callArg = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArg.where.isDeleted).toBe(false)
    expect(callArg.where.type).toBe('TOOL')
  })
})

// ==========================================================================
// updateMaintenanceData — Story 18.4
// ==========================================================================

describe('updateMaintenanceData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid UUID', async () => {
    const result = await updateMaintenanceData({
      id: 'bad',
      lastMaintenanceDate: new Date(),
      maintenanceIntervalDays: 30,
    } as never)
    expect(result.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects interval < 1', async () => {
    const result = await updateMaintenanceData({
      id: validId,
      lastMaintenanceDate: new Date(),
      maintenanceIntervalDays: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects interval > 365', async () => {
    const result = await updateMaintenanceData({
      id: validId,
      lastMaintenanceDate: new Date(),
      maintenanceIntervalDays: 400,
    })
    expect(result.success).toBe(false)
  })

  it('rejects when item not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await updateMaintenanceData({
      id: validId,
      lastMaintenanceDate: new Date(),
      maintenanceIntervalDays: 30,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item not found.')
  })

  it('rejects when item is soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({ type: 'TOOL', isDeleted: true } as never)
    const result = await updateMaintenanceData({
      id: validId,
      lastMaintenanceDate: new Date(),
      maintenanceIntervalDays: 30,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item not found.')
  })

  it('rejects when item is not a TOOL', async () => {
    mockFindUnique.mockResolvedValue({ type: 'MATERIAL', isDeleted: false } as never)
    const result = await updateMaintenanceData({
      id: validId,
      lastMaintenanceDate: new Date(),
      maintenanceIntervalDays: 30,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Maintenance only applies to tools.')
  })

  it('updates maintenance data on a valid TOOL', async () => {
    mockFindUnique.mockResolvedValue({ type: 'TOOL', isDeleted: false } as never)
    mockUpdate.mockResolvedValue({ id: validId } as never)

    const when = new Date('2026-04-01T00:00:00Z')
    const result = await updateMaintenanceData({
      id: validId,
      lastMaintenanceDate: when,
      maintenanceIntervalDays: 60,
    })
    expect(result.success).toBe(true)

    const call = mockUpdate.mock.calls[0][0] as {
      data: { lastMaintenanceDate: Date; maintenanceIntervalDays: number }
    }
    expect(call.data.lastMaintenanceDate).toEqual(when)
    expect(call.data.maintenanceIntervalDays).toBe(60)
  })
})

// ==========================================================================
// recordMaintenance — Story 18.4
// ==========================================================================

describe('recordMaintenance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid UUID', async () => {
    const result = await recordMaintenance('bad')
    expect(result.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects when item not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await recordMaintenance(validId)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item not found.')
  })

  it('rejects when soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({
      type: 'TOOL',
      maintenanceIntervalDays: 30,
      isDeleted: true,
    } as never)
    const result = await recordMaintenance(validId)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item not found.')
  })

  it('rejects when item is not a TOOL', async () => {
    mockFindUnique.mockResolvedValue({
      type: 'MATERIAL',
      maintenanceIntervalDays: 30,
      isDeleted: false,
    } as never)
    const result = await recordMaintenance(validId)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Maintenance only applies to tools.')
  })

  it('rejects when no interval configured', async () => {
    mockFindUnique.mockResolvedValue({
      type: 'TOOL',
      maintenanceIntervalDays: null,
      isDeleted: false,
    } as never)
    const result = await recordMaintenance(validId)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('No maintenance interval configured.')
  })

  it('stamps lastMaintenanceDate to now on success', async () => {
    mockFindUnique.mockResolvedValue({
      type: 'TOOL',
      maintenanceIntervalDays: 30,
      isDeleted: false,
    } as never)
    mockUpdate.mockResolvedValue({ id: validId } as never)

    const before = Date.now()
    const result = await recordMaintenance(validId)
    expect(result.success).toBe(true)

    const call = mockUpdate.mock.calls[0][0] as {
      data: { lastMaintenanceDate: Date }
    }
    expect(call.data.lastMaintenanceDate.getTime()).toBeGreaterThanOrEqual(before)
  })
})
