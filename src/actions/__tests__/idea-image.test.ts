import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    ideaImage: {
      findUnique: vi.fn(),
      delete: vi.fn(),
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

import { getIdeaImage, addIdeaImage, addIdeaImageLink, deleteIdeaImage } from '../idea-image'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { prisma } from '@/lib/db'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_URL = 'https://example.com/photo.jpg'

const mockTransaction = vi.mocked(prisma.$transaction)
const mockFindUnique = vi.mocked(prisma.ideaImage.findUnique)
const mockDelete = vi.mocked(prisma.ideaImage.delete)
const mockAdapter = vi.mocked(getImageStorageAdapter)

describe('getIdeaImage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid UUID', async () => {
    const result = await getIdeaImage('bad')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid idea ID.')
  })

  it('returns null when no image', async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await getIdeaImage(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.image).toBeNull()
  })

  it('builds displayUrl/thumbnailUrl for UPLOAD images', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'img1',
      ideaId: VALID_UUID,
      type: 'UPLOAD',
      storageKey: 'ideas/abc/def.jpg',
      url: null,
      originalFilename: 'photo.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 12345,
      createdAt: new Date('2026-01-01'),
    } as never)

    const result = await getIdeaImage(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success && result.data.image) {
      expect(result.data.image.displayUrl).toBe('https://r2.example.com/bucket/ideas/abc/def.jpg')
      expect(result.data.image.thumbnailUrl).toContain('w=96')
    }
  })

  it('uses url field for LINK images', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'img1',
      ideaId: VALID_UUID,
      type: 'LINK',
      storageKey: null,
      url: VALID_URL,
      originalFilename: null,
      contentType: null,
      sizeBytes: null,
      createdAt: new Date('2026-01-01'),
    } as never)

    const result = await getIdeaImage(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success && result.data.image) {
      expect(result.data.image.displayUrl).toBe(VALID_URL)
      expect(result.data.image.thumbnailUrl).toBe(VALID_URL)
    }
  })
})

describe('addIdeaImageLink', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid ideaId', async () => {
    const result = await addIdeaImageLink({ ideaId: 'bad', url: VALID_URL })
    expect(result.success).toBe(false)
  })

  it('rejects invalid URL', async () => {
    const result = await addIdeaImageLink({ ideaId: VALID_UUID, url: 'not-url' })
    expect(result.success).toBe(false)
  })

  it('returns error when idea not found', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        idea: { findUnique: vi.fn().mockResolvedValue(null) },
        ideaImage: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn() },
      }
      return fn(tx as never)
    })

    const result = await addIdeaImageLink({ ideaId: VALID_UUID, url: VALID_URL })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Idea not found.')
  })

  it('creates LINK image when no existing image (no replace path)', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'img1' })
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        idea: { findUnique: vi.fn().mockResolvedValue({ hobbyId: 'h1' }) },
        ideaImage: {
          findUnique: vi.fn().mockResolvedValue(null),
          delete: vi.fn(),
          create: mockCreate,
        },
      }
      return fn(tx as never)
    })

    const result = await addIdeaImageLink({ ideaId: VALID_UUID, url: VALID_URL })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('img1')
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        ideaId: VALID_UUID,
        storageKey: null,
        url: VALID_URL,
        originalFilename: null,
        contentType: null,
        sizeBytes: null,
        type: 'LINK',
      },
    })
  })

  it('replaces existing UPLOAD image and cleans up old storage', async () => {
    const mockOldDelete = vi.fn()
    const mockCreate = vi.fn().mockResolvedValue({ id: 'img-new' })
    const mockDeleteObject = vi.fn().mockResolvedValue(undefined)

    mockAdapter.mockReturnValueOnce({
      getPublicUrl: vi.fn(),
      getThumbnailUrl: vi.fn(),
      deleteObject: mockDeleteObject,
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
    } as never)

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        idea: { findUnique: vi.fn().mockResolvedValue({ hobbyId: 'h1' }) },
        ideaImage: {
          findUnique: vi.fn().mockResolvedValue({
            storageKey: 'ideas/abc/old.jpg',
            type: 'UPLOAD',
          }),
          delete: mockOldDelete,
          create: mockCreate,
        },
      }
      return fn(tx as never)
    })

    const result = await addIdeaImageLink({ ideaId: VALID_UUID, url: VALID_URL })
    expect(result.success).toBe(true)
    expect(mockOldDelete).toHaveBeenCalledWith({ where: { ideaId: VALID_UUID } })
    expect(mockDeleteObject).toHaveBeenCalledWith('ideas/abc/old.jpg')
  })
})

const validUploadInput = {
  ideaId: VALID_UUID,
  storageKey: 'ideas/abc/def.jpg',
  originalFilename: 'photo.jpg',
  contentType: 'image/jpeg' as const,
  sizeBytes: 12345,
}

describe('addIdeaImage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid storage key format', async () => {
    const result = await addIdeaImage({ ...validUploadInput, storageKey: 'bad/key' })
    expect(result.success).toBe(false)
  })

  it('creates UPLOAD image on success', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'img1' })
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        idea: { findUnique: vi.fn().mockResolvedValue({ hobbyId: 'h1' }) },
        ideaImage: {
          findUnique: vi.fn().mockResolvedValue(null),
          delete: vi.fn(),
          create: mockCreate,
        },
      }
      return fn(tx as never)
    })

    const result = await addIdeaImage(validUploadInput)
    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        ideaId: VALID_UUID,
        storageKey: 'ideas/abc/def.jpg',
        url: null,
        originalFilename: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 12345,
        type: 'UPLOAD',
      },
    })
  })

  it('cleans up orphan when DB transaction fails', async () => {
    const mockDeleteObject = vi.fn().mockResolvedValue(undefined)
    mockAdapter.mockReturnValueOnce({
      getPublicUrl: vi.fn(),
      getThumbnailUrl: vi.fn(),
      deleteObject: mockDeleteObject,
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
    } as never)

    mockTransaction.mockRejectedValue(new Error('DB fail'))

    const result = await addIdeaImage(validUploadInput)
    expect(result.success).toBe(false)
    expect(mockDeleteObject).toHaveBeenCalledWith('ideas/abc/def.jpg')
  })
})

describe('deleteIdeaImage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid ideaId', async () => {
    const result = await deleteIdeaImage('bad')
    expect(result.success).toBe(false)
  })

  it('returns error when image not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await deleteIdeaImage(VALID_UUID)
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
      type: 'UPLOAD',
      storageKey: 'ideas/abc/def.jpg',
      idea: { hobbyId: 'h1' },
    } as never)
    mockDelete.mockResolvedValue({} as never)

    const result = await deleteIdeaImage(VALID_UUID)
    expect(result.success).toBe(true)
    expect(mockDeleteObj).toHaveBeenCalledWith('ideas/abc/def.jpg')
    expect(mockDelete).toHaveBeenCalledWith({ where: { ideaId: VALID_UUID } })
  })

  it('deletes LINK image from DB only (no storage call)', async () => {
    const mockDeleteObj = vi.fn()
    mockAdapter.mockReturnValue({
      getPublicUrl: vi.fn(),
      getThumbnailUrl: vi.fn(),
      deleteObject: mockDeleteObj,
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
    } as never)
    mockFindUnique.mockResolvedValue({
      type: 'LINK',
      storageKey: null,
      idea: { hobbyId: 'h1' },
    } as never)
    mockDelete.mockResolvedValue({} as never)

    const result = await deleteIdeaImage(VALID_UUID)
    expect(result.success).toBe(true)
    expect(mockDeleteObj).not.toHaveBeenCalled()
  })
})
