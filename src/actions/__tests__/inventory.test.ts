import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    inventoryItem: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createInventoryItem, getInventoryItems } from '../inventory'
import { prisma } from '@/lib/db'

const mockCreate = vi.mocked(prisma.inventoryItem.create)
const mockFindMany = vi.mocked(prisma.inventoryItem.findMany)

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
    mockFindMany.mockResolvedValue([{ id: 'i1', name: 'Item' }] as never)
    const result = await getInventoryItems()
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toHaveLength(1)
  })

  it('filters by type', async () => {
    mockFindMany.mockResolvedValue([] as never)
    await getInventoryItems('TOOL')
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { type: 'TOOL' },
      orderBy: { createdAt: 'desc' },
    })
  })
})
