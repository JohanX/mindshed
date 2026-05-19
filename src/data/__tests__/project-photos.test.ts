import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    stepImage: {
      findMany: vi.fn(),
    },
  },
}))

// Story 35.6 / FR139 — extend the existing adapter mock with the video
// methods so `resolveProjectThumbnailUrl` can exercise the VIDEO branches.
const mockGetThumbnailUrl = vi.fn((key: string, width: number) => `thumb:${key}:${width}`)
let mockVideoPosterReturns: string | null = 'poster:default'
const mockGetVideoPosterUrl = vi.fn(() => mockVideoPosterReturns)
let mockAdapter: ReturnType<typeof makeAdapter> | null = makeAdapter()

function makeAdapter() {
  return {
    getPublicUrl: vi.fn((key: string) => `public:${key}`),
    getThumbnailUrl: mockGetThumbnailUrl,
    getVideoUrl: vi.fn((key: string) => `video:${key}`),
    getVideoPosterUrl: mockGetVideoPosterUrl,
    deleteObject: vi.fn(),
    generatePresignedUrl: vi.fn(),
    upload: vi.fn(),
  }
}

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: () => mockAdapter,
}))

import { fetchLatestPhotosByProject, resolveProjectThumbnailUrl } from '../project-photos'
import { prisma } from '@/lib/db'

const mockFindMany = vi.mocked(prisma.stepImage.findMany)

describe('fetchLatestPhotosByProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdapter = makeAdapter()
    mockVideoPosterReturns = 'poster:default'
  })

  it('returns empty Map when no project ids provided', async () => {
    const result = await fetchLatestPhotosByProject([])
    expect(result.size).toBe(0)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('orders by createdAt desc — project-card hero stays DESC by design', async () => {
    // Story 34.2 / FR131 — step + gallery surfaces flipped to ASC for
    // build-log timeline narrative, but project-card hero photo stays
    // DESC because that surface intentionally surfaces the most-recent
    // photo. This test locks in the asymmetry: a future maintainer who
    // tries to "unify" the ordering will break the project-card hero
    // semantic and this test will fail loudly.
    //
    // Story 35.6 / FR139 — select widened to include mediaType + type +
    // url so the resolver can branch on VIDEO. The test pins the exact
    // select shape so a future caller can't accidentally drop a field
    // (which would silently break VIDEO rendering).
    mockFindMany.mockResolvedValue([])
    await fetchLatestPhotosByProject(['p1', 'p2'])
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { step: { projectId: { in: ['p1', 'p2'] } } },
      orderBy: { createdAt: 'desc' },
      select: {
        storageKey: true,
        originalFilename: true,
        mediaType: true,
        type: true,
        url: true,
        step: { select: { projectId: true } },
      },
    })
  })

  it('returns the FIRST photo per project (most recent given DESC order)', async () => {
    mockFindMany.mockResolvedValue([
      {
        storageKey: 'newest-p1',
        originalFilename: 'newest.jpg',
        mediaType: 'IMAGE',
        type: 'UPLOAD',
        url: null,
        step: { projectId: 'p1' },
      },
      {
        storageKey: 'older-p1',
        originalFilename: 'older.jpg',
        mediaType: 'IMAGE',
        type: 'UPLOAD',
        url: null,
        step: { projectId: 'p1' },
      },
      {
        storageKey: 'newest-p2',
        originalFilename: 'p2-newest.jpg',
        mediaType: 'IMAGE',
        type: 'UPLOAD',
        url: null,
        step: { projectId: 'p2' },
      },
    ] as never)
    const result = await fetchLatestPhotosByProject(['p1', 'p2'])
    expect(result.size).toBe(2)
    expect(result.get('p1')).toEqual({
      storageKey: 'newest-p1',
      originalFilename: 'newest.jpg',
      mediaType: 'IMAGE',
      type: 'UPLOAD',
      url: null,
    })
    expect(result.get('p2')).toEqual({
      storageKey: 'newest-p2',
      originalFilename: 'p2-newest.jpg',
      mediaType: 'IMAGE',
      type: 'UPLOAD',
      url: null,
    })
  })

  // Story 35.6 / FR139 — verify the widened select propagates VIDEO fields
  // through to the resulting Map so callers can render the VIDEO branches.
  it('propagates mediaType=VIDEO through to the Map for VIDEO uploads', async () => {
    mockFindMany.mockResolvedValue([
      {
        storageKey: 'steps/abc/video-xyz',
        originalFilename: 'clip.mp4',
        mediaType: 'VIDEO',
        type: 'UPLOAD',
        url: null,
        step: { projectId: 'p1' },
      },
    ] as never)
    const result = await fetchLatestPhotosByProject(['p1'])
    expect(result.get('p1')).toEqual({
      storageKey: 'steps/abc/video-xyz',
      originalFilename: 'clip.mp4',
      mediaType: 'VIDEO',
      type: 'UPLOAD',
      url: null,
    })
  })
})

// Story 35.6 / FR139 — resolveProjectThumbnailUrl branches:
//   VIDEO + UPLOAD + storageKey → adapter.getVideoPosterUrl (Cloudinary
//     returns so_auto URL; S3 returns null and caller renders generic
//     play-icon card via ProjectCard).
//   IMAGE + UPLOAD + storageKey → existing adapter.getThumbnailUrl.
//   Anything else → null.
describe('resolveProjectThumbnailUrl (Story 35.6 / FR139)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdapter = makeAdapter()
    mockVideoPosterReturns = 'poster:default'
  })

  it('returns Cloudinary poster URL for VIDEO + UPLOAD on Cloudinary', () => {
    mockVideoPosterReturns = 'https://cdn.example.com/poster/key.jpg'
    const url = resolveProjectThumbnailUrl({
      storageKey: 'steps/abc/video-xyz',
      originalFilename: 'clip.mp4',
      mediaType: 'VIDEO',
      type: 'UPLOAD',
      url: null,
    })
    expect(url).toBe('https://cdn.example.com/poster/key.jpg')
    expect(mockGetVideoPosterUrl).toHaveBeenCalledTimes(1)
    expect(mockGetThumbnailUrl).not.toHaveBeenCalled()
  })

  it('returns null for VIDEO + UPLOAD on S3 (getVideoPosterUrl returns null)', () => {
    mockVideoPosterReturns = null
    const url = resolveProjectThumbnailUrl({
      storageKey: 'steps/abc/video-xyz',
      originalFilename: 'clip.mp4',
      mediaType: 'VIDEO',
      type: 'UPLOAD',
      url: null,
    })
    // Null is the contract — `ProjectCard` renders a generic play-icon
    // card when this returns null. This is the load-bearing assertion
    // for the 2026-05-15 prod bug: the user must NEVER receive an
    // `/image/upload/<video-key>` URL that 404s.
    expect(url).toBeNull()
    expect(mockGetThumbnailUrl).not.toHaveBeenCalled()
  })

  it('returns null for VIDEO + LINK (FR134 OUT-of-V1)', () => {
    const url = resolveProjectThumbnailUrl({
      storageKey: null,
      originalFilename: 'clip.mp4',
      mediaType: 'VIDEO',
      type: 'LINK',
      url: 'https://example.com/clip.mp4',
    })
    expect(url).toBeNull()
    // Defensive: neither adapter method should have been called for a
    // LINK row.
    expect(mockGetVideoPosterUrl).not.toHaveBeenCalled()
    expect(mockGetThumbnailUrl).not.toHaveBeenCalled()
  })

  it('returns null for VIDEO + UPLOAD with missing storageKey', () => {
    const url = resolveProjectThumbnailUrl({
      storageKey: null,
      originalFilename: 'clip.mp4',
      mediaType: 'VIDEO',
      type: 'UPLOAD',
      url: null,
    })
    expect(url).toBeNull()
  })

  it('returns IMAGE thumbnail URL for IMAGE + UPLOAD (regression guard)', () => {
    // The original path must remain unchanged — this assertion will fail
    // loudly if a future refactor accidentally routes IMAGE rows through
    // the VIDEO branch.
    const url = resolveProjectThumbnailUrl({
      storageKey: 'steps/abc/photo.jpg',
      originalFilename: 'photo.jpg',
      mediaType: 'IMAGE',
      type: 'UPLOAD',
      url: null,
    })
    expect(url).toBe('thumb:steps/abc/photo.jpg:128')
    expect(mockGetThumbnailUrl).toHaveBeenCalledWith('steps/abc/photo.jpg', 128)
    expect(mockGetVideoPosterUrl).not.toHaveBeenCalled()
  })

  it('returns null when no adapter is configured', () => {
    mockAdapter = null
    const url = resolveProjectThumbnailUrl({
      storageKey: 'steps/abc/photo.jpg',
      originalFilename: 'photo.jpg',
      mediaType: 'IMAGE',
      type: 'UPLOAD',
      url: null,
    })
    expect(url).toBeNull()
  })

  it('returns null when adapter.getThumbnailUrl throws', () => {
    mockGetThumbnailUrl.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const url = resolveProjectThumbnailUrl({
      storageKey: 'steps/abc/photo.jpg',
      originalFilename: 'photo.jpg',
      mediaType: 'IMAGE',
      type: 'UPLOAD',
      url: null,
    })
    expect(url).toBeNull()
  })

  it('returns null when storageKey is null (no photo)', () => {
    const url = resolveProjectThumbnailUrl({
      storageKey: null,
      originalFilename: null,
      mediaType: 'IMAGE',
      type: 'UPLOAD',
      url: null,
    })
    expect(url).toBeNull()
  })

  it('returns null for null photo input', () => {
    expect(resolveProjectThumbnailUrl(null)).toBeNull()
    expect(resolveProjectThumbnailUrl(undefined)).toBeNull()
  })
})
