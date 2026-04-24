import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    inventoryItemImage: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    inventoryItem: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(() => ({
    getPublicUrl: vi.fn((key: string) => `https://r2.example.com/bucket/${key}`),
    getThumbnailUrl: vi.fn(
      (key: string, width: number) => `https://r2.example.com/bucket/${key}?w=${width}`,
    ),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    generatePresignedUrl: vi.fn(),
    upload: vi.fn(),
  })),
}))

import {
  getInventoryItemImages,
  addInventoryItemImage,
  addInventoryItemImageLink,
  deleteInventoryItemImage,
} from '../inventory-image'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { prisma } from '@/lib/db'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_URL = 'https://example.com/photo.jpg'

const mockTransaction = vi.mocked(prisma.$transaction)
const mockFindMany = vi.mocked(prisma.inventoryItemImage.findMany)
const mockFindUnique = vi.mocked(prisma.inventoryItemImage.findUnique)
const mockDelete = vi.mocked(prisma.inventoryItemImage.delete)
const mockAdapter = vi.mocked(getImageStorageAdapter)

describe('getInventoryItemImages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid UUID', async () => {
    const result = await getInventoryItemImages('bad')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid inventory item ID.')
  })

  it('returns empty array when no images', async () => {
    mockFindMany.mockResolvedValue([])
    const result = await getInventoryItemImages(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.images).toEqual([])
  })

  it('constructs displayUrl from adapter for UPLOAD images', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'img1',
        inventoryItemId: VALID_UUID,
        type: 'UPLOAD',
        storageKey: 'inventory/abc/def.jpg',
        url: null,
        originalFilename: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 12345,
        createdAt: new Date('2026-01-01'),
      },
    ] as never)

    const result = await getInventoryItemImages(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.images).toHaveLength(1)
      expect(result.data.images[0].displayUrl).toBe(
        'https://r2.example.com/bucket/inventory/abc/def.jpg',
      )
    }
  })

  it('uses url field for LINK images', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'img2',
        inventoryItemId: VALID_UUID,
        type: 'LINK',
        storageKey: null,
        url: 'https://example.com/photo.jpg',
        originalFilename: null,
        contentType: null,
        sizeBytes: null,
        createdAt: new Date('2026-01-02'),
      },
    ] as never)

    const result = await getInventoryItemImages(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.images[0].displayUrl).toBe('https://example.com/photo.jpg')
    }
  })

  it('orders by createdAt asc', async () => {
    mockFindMany.mockResolvedValue([])
    await getInventoryItemImages(VALID_UUID)
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { inventoryItemId: VALID_UUID },
      orderBy: { createdAt: 'asc' },
    })
  })
})

describe('addInventoryItemImageLink', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid inventoryItemId', async () => {
    const result = await addInventoryItemImageLink({ inventoryItemId: 'bad', url: VALID_URL })
    expect(result.success).toBe(false)
  })

  it('rejects invalid URL', async () => {
    const result = await addInventoryItemImageLink({ inventoryItemId: VALID_UUID, url: 'not-url' })
    expect(result.success).toBe(false)
  })

  it('rejects ftp:// URL', async () => {
    const result = await addInventoryItemImageLink({
      inventoryItemId: VALID_UUID,
      url: 'ftp://example.com/file',
    })
    expect(result.success).toBe(false)
  })

  it('returns error when item not found', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        inventoryItem: { findUnique: vi.fn().mockResolvedValue(null) },
        inventoryItemImage: { create: vi.fn() },
      }
      return fn(tx as never)
    })

    const result = await addInventoryItemImageLink({ inventoryItemId: VALID_UUID, url: VALID_URL })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item not found.')
  })

  it('returns error when item is soft-deleted', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        inventoryItem: { findUnique: vi.fn().mockResolvedValue({ isDeleted: true }) },
        inventoryItemImage: { create: vi.fn() },
      }
      return fn(tx as never)
    })

    const result = await addInventoryItemImageLink({ inventoryItemId: VALID_UUID, url: VALID_URL })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item has been deleted.')
  })

  it('creates LINK image on success', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'img1' })
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        inventoryItem: { findUnique: vi.fn().mockResolvedValue({ isDeleted: false }) },
        inventoryItemImage: { create: mockCreate },
      }
      return fn(tx as never)
    })

    const result = await addInventoryItemImageLink({ inventoryItemId: VALID_UUID, url: VALID_URL })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('img1')
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        inventoryItemId: VALID_UUID,
        type: 'LINK',
        url: VALID_URL,
        storageKey: null,
      },
    })
  })
})

const validUploadInput = {
  inventoryItemId: VALID_UUID,
  storageKey: 'inventory/abc/def.jpg',
  originalFilename: 'photo.jpg',
  contentType: 'image/jpeg' as const,
  sizeBytes: 12345,
}

describe('addInventoryItemImage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid inventoryItemId', async () => {
    const result = await addInventoryItemImage({ ...validUploadInput, inventoryItemId: 'bad' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid storageKey format', async () => {
    const result = await addInventoryItemImage({ ...validUploadInput, storageKey: 'bad/key' })
    expect(result.success).toBe(false)
  })

  it('returns error when item not found', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        inventoryItem: { findUnique: vi.fn().mockResolvedValue(null) },
        inventoryItemImage: { create: vi.fn() },
      }
      return fn(tx as never)
    })

    const result = await addInventoryItemImage(validUploadInput)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Item not found.')
  })

  it('creates UPLOAD image on success', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'img1' })
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        inventoryItem: { findUnique: vi.fn().mockResolvedValue({ isDeleted: false }) },
        inventoryItemImage: { create: mockCreate },
      }
      return fn(tx as never)
    })

    const result = await addInventoryItemImage(validUploadInput)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('img1')
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        inventoryItemId: VALID_UUID,
        storageKey: 'inventory/abc/def.jpg',
        originalFilename: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 12345,
        type: 'UPLOAD',
      },
    })
  })

  it('cleans up orphan when DB insert fails', async () => {
    const mockDeleteObject = vi.fn().mockResolvedValue(undefined)
    mockAdapter.mockReturnValueOnce({
      getPublicUrl: vi.fn(),
      getThumbnailUrl: vi.fn(),
      deleteObject: mockDeleteObject,
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
    } as never)

    mockTransaction.mockRejectedValue(new Error('DB fail'))

    const result = await addInventoryItemImage(validUploadInput)
    expect(result.success).toBe(false)
    expect(mockDeleteObject).toHaveBeenCalledWith('inventory/abc/def.jpg')
  })
})

describe('deleteInventoryItemImage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid imageId', async () => {
    const result = await deleteInventoryItemImage('bad')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid image ID.')
  })

  it('returns error when image not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await deleteInventoryItemImage(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Image not found.')
  })

  it('deletes UPLOAD image from storage + DB', async () => {
    const mockDeleteObj = vi.fn().mockResolvedValue(undefined)
    mockAdapter.mockReturnValue({
      getPublicUrl: vi.fn(),
      getThumbnailUrl: vi.fn(),
      deleteObject: mockDeleteObj,
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
    } as never)
    mockFindUnique.mockResolvedValue({
      id: VALID_UUID,
      type: 'UPLOAD',
      storageKey: 'inventory/abc/def.jpg',
    } as never)
    mockDelete.mockResolvedValue({} as never)

    const result = await deleteInventoryItemImage(VALID_UUID)
    expect(result.success).toBe(true)
    expect(mockDeleteObj).toHaveBeenCalledWith('inventory/abc/def.jpg')
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: VALID_UUID } })
  })

  it('deletes LINK image from DB only', async () => {
    const mockDeleteObj = vi.fn()
    mockAdapter.mockReturnValue({
      getPublicUrl: vi.fn(),
      getThumbnailUrl: vi.fn(),
      deleteObject: mockDeleteObj,
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
    } as never)
    mockFindUnique.mockResolvedValue({
      id: VALID_UUID,
      type: 'LINK',
      storageKey: null,
    } as never)
    mockDelete.mockResolvedValue({} as never)

    const result = await deleteInventoryItemImage(VALID_UUID)
    expect(result.success).toBe(true)
    expect(mockDeleteObj).not.toHaveBeenCalled()
  })

  it('still deletes DB record when storage fails (best effort)', async () => {
    const mockDeleteObj = vi.fn().mockRejectedValue(new Error('Storage error'))
    mockAdapter.mockReturnValue({
      getPublicUrl: vi.fn(),
      getThumbnailUrl: vi.fn(),
      deleteObject: mockDeleteObj,
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
    } as never)
    mockFindUnique.mockResolvedValue({
      id: VALID_UUID,
      type: 'UPLOAD',
      storageKey: 'inventory/abc/def.jpg',
    } as never)
    mockDelete.mockResolvedValue({} as never)

    const result = await deleteInventoryItemImage(VALID_UUID)
    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
  })
})
