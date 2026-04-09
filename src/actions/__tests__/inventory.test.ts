import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    inventoryItem: {
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

import { createInventoryItem, getInventoryItems, updateInventoryItem, deleteInventoryItem } from '../inventory'
import { prisma } from '@/lib/db'

const mockCreate = vi.mocked(prisma.inventoryItem.create)
const mockFindMany = vi.mocked(prisma.inventoryItem.findMany)
const mockUpdate = vi.mocked(prisma.inventoryItem.update)
const mockTransaction = vi.mocked(prisma.$transaction)

describe('createInventoryItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates item with correct fields', async () => {
    mockCreate.mockResolvedValue({ id: 'i1' } as never)
    const result = await createInventoryItem({
      name: 'Walnut lumber',
      type: 'MATERIAL',
      quantity: 5,
      unit: 'boards',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('i1')
  })

  it('validates required name', async () => {
    const result = await createInventoryItem({ name: '', type: 'MATERIAL' })
    expect(result.success).toBe(false)
  })

  it('validates type enum', async () => {
    const result = await createInventoryItem({ name: 'Test', type: 'INVALID' as never })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', async () => {
    const result = await createInventoryItem({ name: 'Test', type: 'TOOL', quantity: -1 })
    expect(result.success).toBe(false)
  })

  it('returns error on DB failure', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'))
    const result = await createInventoryItem({ name: 'Test', type: 'MATERIAL' })
    expect(result.success).toBe(false)
  })
})

describe('getInventoryItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all items when no filter', async () => {
    mockFindMany.mockResolvedValue([{ id: 'i1', name: 'Item', _count: { blockers: 0 } }] as never)
    const result = await getInventoryItems()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0].activeBlockerCount).toBe(0)
    }
  })

  it('filters by type', async () => {
    mockFindMany.mockResolvedValue([] as never)
    await getInventoryItems('TOOL')
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { type: 'TOOL' },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { blockers: { where: { isResolved: false } } } } },
    })
  })
})

describe('updateInventoryItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates item with correct fields', async () => {
    mockUpdate.mockResolvedValue({ id: 'i1' } as never)
    const result = await updateInventoryItem({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Updated',
      type: 'TOOL',
    })
    expect(result.success).toBe(true)
  })

  it('validates required name', async () => {
    const result = await updateInventoryItem({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: '',
      type: 'MATERIAL',
    })
    expect(result.success).toBe(false)
  })

  it('returns error for non-existent item', async () => {
    mockUpdate.mockRejectedValue({ code: 'P2025' })
    const result = await updateInventoryItem({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      type: 'MATERIAL',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item not found.')
  })
})

describe('deleteInventoryItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes item', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = { inventoryItem: { delete: vi.fn() }, blocker: { updateMany: vi.fn() } }
      return fn(tx as never)
    })
    const result = await deleteInventoryItem('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(true)
  })

  it('validates UUID input', async () => {
    const result = await deleteInventoryItem('bad-id')
    expect(result.success).toBe(false)
  })

  it('returns error for non-existent item', async () => {
    mockTransaction.mockRejectedValue({ code: 'P2025' })
    const result = await deleteInventoryItem('550e8400-e29b-41d4-a716-446655440000')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item not found.')
  })
})
