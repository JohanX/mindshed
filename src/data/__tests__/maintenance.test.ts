import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    inventoryItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { findScheduledMaintenanceTools, findInventoryItemMaintenance } from '../maintenance'
import { prisma } from '@/lib/db'

const mockFindMany = vi.mocked(prisma.inventoryItem.findMany)
const mockFindUnique = vi.mocked(prisma.inventoryItem.findUnique)

describe('findScheduledMaintenanceTools', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters TOOL + non-deleted + has maintenance config', async () => {
    mockFindMany.mockResolvedValue([])
    await findScheduledMaintenanceTools()
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        type: 'TOOL',
        lastMaintenanceDate: { not: null },
        maintenanceIntervalDays: { not: null },
      },
      orderBy: { lastMaintenanceDate: 'asc' },
    })
  })
})

describe('findInventoryItemMaintenance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('selects only the maintenance-relevant fields', async () => {
    mockFindUnique.mockResolvedValue({
      type: 'TOOL',
      isDeleted: false,
      maintenanceIntervalDays: 30,
    } as never)
    await findInventoryItemMaintenance('inv1')
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      select: { type: true, isDeleted: true, maintenanceIntervalDays: true },
    })
  })

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await findInventoryItemMaintenance('inv1')).toBeNull()
  })
})
