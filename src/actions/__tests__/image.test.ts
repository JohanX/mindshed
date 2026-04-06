import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    step: {
      findUnique: vi.fn(),
    },
    stepImage: {
      create: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { addStepImageLink, addStepImage } from '../image'
import { prisma } from '@/lib/db'

const mockStepFindUnique = vi.mocked(prisma.step.findUnique)
const mockStepImageCreate = vi.mocked(prisma.stepImage.create)
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
