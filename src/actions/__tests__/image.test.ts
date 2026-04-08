import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    step: {
      findUnique: vi.fn(),
    },
    stepImage: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(() => ({
    getPublicUrl: vi.fn((key: string) => `https://r2.example.com/bucket/${key}`),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    generatePresignedUrl: vi.fn().mockResolvedValue({ url: 'https://presigned.url', key: 'test-key' }),
    upload: vi.fn().mockResolvedValue({ publicUrl: 'https://cdn.example.com/img.jpg', storageKey: 'test-key' }),
  })),
}))

import { addStepImageLink, addStepImage, getStepImages, deleteStepImage } from '../image'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { prisma } from '@/lib/db'

const mockProjectUpdate = vi.mocked(prisma.project.update)

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_URL = 'https://example.com/image.jpg'

describe('addStepImageLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid stepId', async () => {
    const result = await addStepImageLink({ stepId: 'bad', url: VALID_URL })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
  })

  it('rejects invalid URL', async () => {
    const result = await addStepImageLink({ stepId: VALID_UUID, url: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('rejects ftp:// URL', async () => {
    const result = await addStepImageLink({ stepId: VALID_UUID, url: 'ftp://example.com/file' })
    expect(result.success).toBe(false)
  })

  it('returns error when step not found', async () => {
    const mockTx = vi.mocked(prisma.$transaction)
    mockTx.mockImplementation(async (fn) => {
      const tx = {
        step: { findUnique: vi.fn().mockResolvedValue(null) },
        stepImage: { create: vi.fn() },
        project: { update: vi.fn() },
      }
      return fn(tx as never)
    })

    const result = await addStepImageLink({ stepId: VALID_UUID, url: VALID_URL })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })

  it('returns error when project is completed', async () => {
    const mockTx = vi.mocked(prisma.$transaction)
    mockTx.mockImplementation(async (fn) => {
      const tx = {
        step: { findUnique: vi.fn().mockResolvedValue({ projectId: 'p1', project: { id: 'p1', hobbyId: 'h1', isCompleted: true } }) },
        stepImage: { create: vi.fn() },
        project: { update: vi.fn() },
      }
      return fn(tx as never)
    })

    const result = await addStepImageLink({ stepId: VALID_UUID, url: VALID_URL })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Cannot add images to a completed project.')
  })

  it('creates StepImage with type LINK and updates lastActivityAt', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'img1' })
    const mockUpdate = vi.fn().mockResolvedValue({})
    const mockTx = vi.mocked(prisma.$transaction)
    mockTx.mockImplementation(async (fn) => {
      const tx = {
        step: { findUnique: vi.fn().mockResolvedValue({ projectId: 'p1', project: { id: 'p1', hobbyId: 'h1', isCompleted: false } }) },
        stepImage: { create: mockCreate },
        project: { update: mockUpdate },
      }
      return fn(tx as never)
    })

    const result = await addStepImageLink({ stepId: VALID_UUID, url: VALID_URL })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('img1')
    expect(mockCreate).toHaveBeenCalledWith({
      data: { stepId: VALID_UUID, type: 'LINK', url: VALID_URL, storageKey: null },
    })
  })
})

const mockTransaction = vi.mocked(prisma.$transaction)

const validUploadInput = {
  stepId: VALID_UUID,
  storageKey: 'steps/abc/def.jpg',
  originalFilename: 'photo.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 12345,
}

describe('addStepImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid stepId', async () => {
    const result = await addStepImage({ ...validUploadInput, stepId: 'bad' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
  })

  it('rejects empty storageKey', async () => {
    const result = await addStepImage({ ...validUploadInput, storageKey: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty originalFilename', async () => {
    const result = await addStepImage({ ...validUploadInput, originalFilename: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty contentType', async () => {
    const result = await addStepImage({ ...validUploadInput, contentType: '' })
    expect(result.success).toBe(false)
  })

  it('rejects zero sizeBytes', async () => {
    const result = await addStepImage({ ...validUploadInput, sizeBytes: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative sizeBytes', async () => {
    const result = await addStepImage({ ...validUploadInput, sizeBytes: -100 })
    expect(result.success).toBe(false)
  })

  it('returns error when step not found', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: { findUnique: vi.fn().mockResolvedValue(null) },
        stepImage: { create: vi.fn() },
        project: { update: vi.fn() },
      }
      return fn(tx as never)
    })

    const result = await addStepImage(validUploadInput)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Step not found.')
  })

  it('creates image and updates lastActivityAt on success', async () => {
    const mockImageCreate = vi.fn().mockResolvedValue({ id: 'img1' })
    const mockProjUpdate = vi.fn().mockResolvedValue({})

    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        step: {
          findUnique: vi.fn().mockResolvedValue({
            projectId: 'p1',
            project: { id: 'p1', hobbyId: 'h1' },
          }),
        },
        stepImage: { create: mockImageCreate },
        project: { update: mockProjUpdate },
      }
      return fn(tx as never)
    })

    const result = await addStepImage(validUploadInput)

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.id).toBe('img1')

    expect(mockImageCreate).toHaveBeenCalledWith({
      data: {
        stepId: VALID_UUID,
        storageKey: 'steps/abc/def.jpg',
        originalFilename: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 12345,
        type: 'UPLOAD',
      },
    })

    expect(mockProjUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { lastActivityAt: expect.any(Date) },
    })
  })

  it('returns generic error on unexpected failure', async () => {
    mockTransaction.mockRejectedValue(new Error('DB connection failed'))

    const result = await addStepImage(validUploadInput)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Failed to add image. Please try again.')
  })
})

const mockStepImageFindMany = vi.mocked(prisma.stepImage.findMany)

describe('getStepImages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid stepId', async () => {
    const result = await getStepImages('not-a-uuid')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Invalid')
  })

  it('returns empty array when no images exist', async () => {
    mockStepImageFindMany.mockResolvedValue([])

    const result = await getStepImages(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.images).toEqual([])
    }
  })

  it('constructs displayUrl from R2 for UPLOAD type images', async () => {
    mockStepImageFindMany.mockResolvedValue([
      {
        id: 'img1',
        stepId: VALID_UUID,
        type: 'UPLOAD',
        storageKey: 'steps/abc/def.jpg',
        url: null,
        originalFilename: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 12345,
        createdAt: new Date('2026-01-01'),
      },
    ] as never)

    const result = await getStepImages(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.images).toHaveLength(1)
      expect(result.data.images[0].displayUrl).toBe('https://r2.example.com/bucket/steps/abc/def.jpg')
    }
  })

  it('uses url field directly for LINK type images', async () => {
    mockStepImageFindMany.mockResolvedValue([
      {
        id: 'img2',
        stepId: VALID_UUID,
        type: 'LINK',
        storageKey: null,
        url: 'https://example.com/photo.jpg',
        originalFilename: null,
        contentType: null,
        sizeBytes: null,
        createdAt: new Date('2026-01-02'),
      },
    ] as never)

    const result = await getStepImages(VALID_UUID)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.images).toHaveLength(1)
      expect(result.data.images[0].displayUrl).toBe('https://example.com/photo.jpg')
    }
  })

  it('orders images by createdAt desc', async () => {
    mockStepImageFindMany.mockResolvedValue([])

    await getStepImages(VALID_UUID)

    expect(mockStepImageFindMany).toHaveBeenCalledWith({
      where: { stepId: VALID_UUID },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('returns error on database failure', async () => {
    mockStepImageFindMany.mockRejectedValue(new Error('DB down'))

    const result = await getStepImages(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Failed to load images.')
  })
})

const mockStepImageFindUnique = vi.mocked(prisma.stepImage.findUnique)
const mockStepImageDelete = vi.mocked(prisma.stepImage.delete)
const mockAdapter = vi.mocked(getImageStorageAdapter)

describe('deleteStepImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid imageId', async () => {
    const result = await deleteStepImage('bad-id')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invalid image ID.')
  })

  it('returns error when image not found', async () => {
    mockStepImageFindUnique.mockResolvedValue(null)
    const result = await deleteStepImage(VALID_UUID)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Image not found.')
  })

  it('deletes UPLOAD image from storage + DB', async () => {
    const mockDeleteObj = vi.fn().mockResolvedValue(undefined)
    mockAdapter.mockReturnValue({
      getPublicUrl: vi.fn(),
      deleteObject: mockDeleteObj,
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
    })
    mockStepImageFindUnique.mockResolvedValue({
      id: VALID_UUID, type: 'UPLOAD', storageKey: 'steps/abc/def.jpg',
      step: { projectId: 'p1', project: { hobbyId: 'h1' } },
    } as never)
    mockStepImageDelete.mockResolvedValue({} as never)
    mockProjectUpdate.mockResolvedValue({} as never)

    const result = await deleteStepImage(VALID_UUID)
    expect(result.success).toBe(true)
    expect(mockDeleteObj).toHaveBeenCalledWith('steps/abc/def.jpg')
    expect(mockStepImageDelete).toHaveBeenCalledWith({ where: { id: VALID_UUID } })
  })

  it('deletes LINK image from DB only', async () => {
    const mockDeleteObj = vi.fn()
    mockAdapter.mockReturnValue({
      getPublicUrl: vi.fn(),
      deleteObject: mockDeleteObj,
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
    })
    mockStepImageFindUnique.mockResolvedValue({
      id: VALID_UUID, type: 'LINK', storageKey: null,
      step: { projectId: 'p1', project: { hobbyId: 'h1' } },
    } as never)
    mockStepImageDelete.mockResolvedValue({} as never)
    mockProjectUpdate.mockResolvedValue({} as never)

    const result = await deleteStepImage(VALID_UUID)
    expect(result.success).toBe(true)
    expect(mockDeleteObj).not.toHaveBeenCalled()
  })

  it('still deletes DB record when storage fails (best effort)', async () => {
    const mockDeleteObj = vi.fn().mockRejectedValue(new Error('Storage error'))
    mockAdapter.mockReturnValue({
      getPublicUrl: vi.fn(),
      deleteObject: mockDeleteObj,
      generatePresignedUrl: vi.fn(),
      upload: vi.fn(),
    })
    mockStepImageFindUnique.mockResolvedValue({
      id: VALID_UUID, type: 'UPLOAD', storageKey: 'steps/abc/def.jpg',
      step: { projectId: 'p1', project: { hobbyId: 'h1' } },
    } as never)
    mockStepImageDelete.mockResolvedValue({} as never)
    mockProjectUpdate.mockResolvedValue({} as never)

    const result = await deleteStepImage(VALID_UUID)
    expect(result.success).toBe(true)
    expect(mockStepImageDelete).toHaveBeenCalled()
  })
})

