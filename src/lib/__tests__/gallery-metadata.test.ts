import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/data/gallery', () => ({
  findJourneyGalleryBySlug: vi.fn(),
  findResultGalleryBySlug: vi.fn(),
}))

vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: vi.fn(),
}))

import { buildJourneyMetadata, buildResultMetadata } from '../gallery-metadata'
import { findJourneyGalleryBySlug, findResultGalleryBySlug } from '@/data/gallery'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { THUMBNAIL_WIDTH } from '@/lib/constants/thumbnail-widths'

const mockFindJourney = vi.mocked(findJourneyGalleryBySlug)
const mockFindResult = vi.mocked(findResultGalleryBySlug)
const mockGetAdapter = vi.mocked(getImageStorageAdapter)

const fakeAdapter = {
  getPublicUrl: vi.fn((key: string) => `https://cdn.example.com/full/${key}`),
  getThumbnailUrl: vi.fn(
    (key: string, width: number) => `https://cdn.example.com/w_${width}/${key}`,
  ),
  getVideoUrl: vi.fn((key: string) => `https://cdn.example.com/video/${key}`),
  getVideoPosterUrl: vi.fn(
    (key: string, width: number) => `https://cdn.example.com/poster/w_${width}/${key}`,
  ),
  deleteObject: vi.fn(),
  generatePresignedUrl: vi.fn(),
  upload: vi.fn(),
}

// Story 35.4 — S3-mode adapter mock: getVideoPosterUrl returns null
// (matches the production S3 adapter contract).
const s3StyleAdapter = {
  ...fakeAdapter,
  getVideoPosterUrl: vi.fn((_key: string, _width: number) => null),
}

function makeUploadImage(key: string, createdAt?: Date) {
  return {
    storageKey: key,
    url: null,
    type: 'UPLOAD' as const,
    originalFilename: `${key}.jpg`,
    createdAt,
    mediaType: 'IMAGE' as const,
  }
}

function makeLinkImage(url: string, createdAt?: Date) {
  return {
    storageKey: null,
    url,
    type: 'LINK' as const,
    originalFilename: null,
    createdAt,
    mediaType: 'IMAGE' as const,
  }
}

// Story 35.4 / FR137 — VIDEO upload row factory. Mirrors makeUploadImage
// but stamps `mediaType: 'VIDEO'` so the metadata builder routes it
// through `resolveStepImagePosterUrl`.
function makeVideoUploadImage(key: string, createdAt?: Date) {
  return {
    storageKey: key,
    url: null,
    type: 'UPLOAD' as const,
    originalFilename: `${key}.mp4`,
    createdAt,
    mediaType: 'VIDEO' as const,
  }
}

describe('buildJourneyMetadata (Story 30.4 / FR128)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAdapter.mockReturnValue(fakeAdapter as never)
  })

  it('returns {} when project does not exist', async () => {
    mockFindJourney.mockResolvedValue(null)
    expect(await buildJourneyMetadata('missing')).toEqual({})
  })

  it('returns {} when journeyGalleryEnabled is false (no leaked OG image before 404)', async () => {
    mockFindJourney.mockResolvedValue({
      name: 'Walnut Side Table',
      description: null,
      journeyGalleryEnabled: false,
      hobby: { name: 'Woodworking', color: 'red', icon: null },
      steps: [{ name: 'Cut', images: [makeUploadImage('photos/walnut-1')], notes: [] }],
    } as never)
    expect(await buildJourneyMetadata('walnut')).toEqual({})
  })

  it('builds title, description, og:image (with width/height), twitter:image for an enabled journey', async () => {
    // walnut-1 in step 1 (older), walnut-2 in step 2 (newer).
    // Story 30.4 fix: primary og:image is the MOST RECENT across all steps
    // (matches dashboard project-card "latest photo" pattern), not the
    // first-step's-first-image.
    const olderDate = new Date('2026-01-01T10:00:00Z')
    const newerDate = new Date('2026-02-01T10:00:00Z')
    mockFindJourney.mockResolvedValue({
      name: 'Walnut Side Table',
      description: 'A solid walnut piece for the living room.',
      journeyGalleryEnabled: true,
      hobby: { name: 'Woodworking', color: 'red', icon: null },
      steps: [
        { name: 'Cut', images: [makeUploadImage('photos/walnut-1', olderDate)], notes: [] },
        { name: 'Sand', images: [makeUploadImage('photos/walnut-2', newerDate)], notes: [] },
      ],
    } as never)

    const meta = await buildJourneyMetadata('walnut-side-table')

    expect(meta.title).toBe('Walnut Side Table — Journey Gallery')
    expect(meta.description).toBe('A solid walnut piece for the living room.')
    expect((meta.openGraph as { type?: string } | undefined)?.type).toBe('website')
    // Newest image first (walnut-2), then walnut-1. og:image entries include
    // width/height so Slack/LinkedIn/Discord can lay out the card before
    // fetching the image.
    expect(meta.openGraph?.images).toEqual([
      {
        url: `https://cdn.example.com/w_${THUMBNAIL_WIDTH.SOCIAL_CARD}/photos/walnut-2`,
        width: THUMBNAIL_WIDTH.SOCIAL_CARD,
        height: 630,
      },
      {
        url: `https://cdn.example.com/w_${THUMBNAIL_WIDTH.SOCIAL_CARD}/photos/walnut-1`,
        width: THUMBNAIL_WIDTH.SOCIAL_CARD,
        height: 630,
      },
    ])
    expect(meta.twitter).toMatchObject({
      card: 'summary_large_image',
      images: [`https://cdn.example.com/w_${THUMBNAIL_WIDTH.SOCIAL_CARD}/photos/walnut-2`],
    })
  })

  it('primary og:image is the latest across all steps (matches dashboard latest-photo)', async () => {
    // Step 3 has the newest image, even though it appears last in sortOrder.
    const t1 = new Date('2026-01-01T00:00:00Z')
    const t2 = new Date('2026-01-02T00:00:00Z')
    const t3 = new Date('2026-01-03T00:00:00Z')
    mockFindJourney.mockResolvedValue({
      name: 'P',
      description: null,
      journeyGalleryEnabled: true,
      hobby: { name: 'H', color: 'red', icon: null },
      steps: [
        { name: 'Step 1', images: [makeUploadImage('photos/old', t1)], notes: [] },
        { name: 'Step 2', images: [makeUploadImage('photos/middle', t2)], notes: [] },
        { name: 'Step 3', images: [makeUploadImage('photos/latest', t3)], notes: [] },
      ],
    } as never)

    const meta = await buildJourneyMetadata('x')
    const urls = (meta.openGraph?.images as { url: string }[]).map((entry) => entry.url)
    // Most recent first — Step 3's image, NOT Step 1's.
    expect(urls[0]).toContain('photos/latest')
    expect(urls).toHaveLength(3)
    expect(urls[1]).toContain('photos/middle')
    expect(urls[2]).toContain('photos/old')
  })

  it('falls back to a step-count description when project.description is null', async () => {
    mockFindJourney.mockResolvedValue({
      name: 'Untitled',
      description: null,
      journeyGalleryEnabled: true,
      hobby: { name: 'Hobby', color: 'red', icon: null },
      steps: [
        { name: 'A', images: [makeUploadImage('a')], notes: [] },
        { name: 'B', images: [makeUploadImage('b')], notes: [] },
        { name: 'C (no images, excluded)', images: [], notes: [] },
      ],
    } as never)

    const meta = await buildJourneyMetadata('x')
    expect(meta.description).toBe('2 steps from idea to completion.')
  })

  it('emits at most 4 og:image tags (primary + 3 extras), deduped', async () => {
    // Stamp images from oldest to newest. With createdAt-DESC sort, the
    // primary should be the newest (`e`).
    const t = (n: number) => new Date(`2026-01-0${n}T00:00:00Z`)
    const dup = makeUploadImage('photos/dup', t(3))
    mockFindJourney.mockResolvedValue({
      name: 'P',
      description: null,
      journeyGalleryEnabled: true,
      hobby: { name: 'H', color: 'red', icon: null },
      steps: [
        { name: '1', images: [makeUploadImage('photos/a', t(1)), dup], notes: [] },
        {
          name: '2',
          images: [makeUploadImage('photos/b', t(2)), dup, makeUploadImage('photos/c', t(4))],
          notes: [],
        },
        {
          name: '3',
          images: [makeUploadImage('photos/d', t(5)), makeUploadImage('photos/e', t(6))],
          notes: [],
        },
      ],
    } as never)

    const meta = await buildJourneyMetadata('x')
    const urls = (meta.openGraph?.images as { url: string }[]).map((entry) => entry.url)
    expect(urls).toHaveLength(4)
    // Each URL appears at most once
    expect(new Set(urls).size).toBe(urls.length)
    // Primary is the most recent (`e` at t6), then in descending recency
    expect(urls[0]).toContain('photos/e')
    expect(urls[1]).toContain('photos/d')
    expect(urls[2]).toContain('photos/c')
    expect(urls[3]).toContain('photos/dup')
  })

  it('uses external URL directly for LINK-type images (no storage adapter call)', async () => {
    mockFindJourney.mockResolvedValue({
      name: 'L',
      description: null,
      journeyGalleryEnabled: true,
      hobby: { name: 'H', color: 'red', icon: null },
      steps: [
        { name: 'Step', images: [makeLinkImage('https://external.com/photo.jpg')], notes: [] },
      ],
    } as never)

    const meta = await buildJourneyMetadata('x')
    expect(meta.openGraph?.images).toEqual([
      { url: 'https://external.com/photo.jpg', width: THUMBNAIL_WIDTH.SOCIAL_CARD, height: 630 },
    ])
    expect(fakeAdapter.getThumbnailUrl).not.toHaveBeenCalled()
  })

  it('omits images from OG when no images exist on any step', async () => {
    mockFindJourney.mockResolvedValue({
      name: 'No Photos Yet',
      description: 'Coming soon.',
      journeyGalleryEnabled: true,
      hobby: { name: 'H', color: 'red', icon: null },
      steps: [{ name: 'A', images: [], notes: [] }],
    } as never)

    const meta = await buildJourneyMetadata('x')
    // Story 35.4 patch: empty image list omits `images` from
    // openGraph entirely (avoids Slack/LinkedIn missing-image card).
    expect(meta.openGraph?.images).toBeUndefined()
    expect(meta.twitter?.images).toBeUndefined()
  })
})

describe('buildResultMetadata (Story 30.4 / FR128)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAdapter.mockReturnValue(fakeAdapter as never)
  })

  it('returns {} when project does not exist', async () => {
    mockFindResult.mockResolvedValue(null)
    expect(await buildResultMetadata('missing')).toEqual({})
  })

  it('returns {} when resultGalleryEnabled is false', async () => {
    mockFindResult.mockResolvedValue({
      name: 'X',
      description: null,
      resultGalleryEnabled: false,
      resultStepId: null,
      hobby: { name: 'H', color: 'red', icon: null },
      steps: [],
    } as never)
    expect(await buildResultMetadata('x')).toEqual({})
  })

  it('uses the explicit resultStep when resultStepId is set', async () => {
    mockFindResult.mockResolvedValue({
      name: 'Vase',
      description: 'Glazed.',
      resultGalleryEnabled: true,
      resultStepId: 'step-explicit',
      hobby: { name: 'Pottery', color: 'red', icon: null },
      steps: [
        { id: 'step-other', state: 'COMPLETED', images: [makeUploadImage('photos/other')] },
        { id: 'step-explicit', state: 'COMPLETED', images: [makeUploadImage('photos/explicit')] },
      ],
    } as never)

    const meta = await buildResultMetadata('vase')
    expect(meta.title).toBe('Vase — Result')
    expect(meta.description).toBe('Glazed.')
    expect((meta.openGraph?.images as { url: string }[])[0].url).toContain('photos/explicit')
  })

  it('falls back to first step (last completed) when resultStepId is null', async () => {
    mockFindResult.mockResolvedValue({
      name: 'Vase',
      description: null,
      resultGalleryEnabled: true,
      resultStepId: null,
      hobby: { name: 'Pottery', color: 'red', icon: null },
      steps: [
        { id: 'step-1', state: 'COMPLETED', images: [makeUploadImage('photos/last')] },
        { id: 'step-2', state: 'COMPLETED', images: [makeUploadImage('photos/earlier')] },
      ],
    } as never)

    const meta = await buildResultMetadata('vase')
    expect((meta.openGraph?.images as { url: string }[])[0].url).toContain('photos/last')
  })

  it('emits NO og:image when the chosen result step has no images (matches page exactly)', async () => {
    // Story 30.4 / FR128: code review rejected the previous "fallback to
    // other steps' images" semantics — the unfurl preview must NOT show
    // photos that the recipient can't find on the landing page.
    mockFindResult.mockResolvedValue({
      name: 'Vase',
      description: null,
      resultGalleryEnabled: true,
      resultStepId: 'step-empty',
      hobby: { name: 'Pottery', color: 'red', icon: null },
      steps: [
        { id: 'step-empty', state: 'COMPLETED', images: [] },
        { id: 'step-other', state: 'COMPLETED', images: [makeUploadImage('photos/other')] },
      ],
    } as never)

    const meta = await buildResultMetadata('vase')
    // Story 35.4 patch: empty image list omits `images` from
    // openGraph entirely (avoids Slack/LinkedIn missing-image card).
    expect(meta.openGraph?.images).toBeUndefined()
    expect(meta.twitter?.images).toBeUndefined()
  })

  it('uses generic description fallback when project.description is null', async () => {
    mockFindResult.mockResolvedValue({
      name: 'Vase',
      description: null,
      resultGalleryEnabled: true,
      resultStepId: null,
      hobby: { name: 'Pottery', color: 'red', icon: null },
      steps: [],
    } as never)

    const meta = await buildResultMetadata('vase')
    expect(meta.description).toBe('Final result from Vase.')
  })

  it('OG cover is the LATEST photo within the result step, even when data layer returns ASC (Story 34.2 / FR131)', async () => {
    // Story 34.2 flipped the result-gallery data accessor's image
    // ordering to ASC for the page renderer's build-log timeline. The
    // OG metadata cover must continue to surface the most-recent photo
    // ("show the finished piece" social-preview semantic) — the helper
    // re-sorts DESC explicitly to decouple the OG cover from the page
    // renderer's order. This test locks in that decoupling.
    const t1 = new Date('2026-01-01T00:00:00Z')
    const t2 = new Date('2026-02-01T00:00:00Z')
    const t3 = new Date('2026-03-01T00:00:00Z')
    mockFindResult.mockResolvedValue({
      name: 'Vase',
      description: 'Glazed.',
      resultGalleryEnabled: true,
      resultStepId: 'step-result',
      hobby: { name: 'Pottery', color: 'red', icon: null },
      steps: [
        {
          id: 'step-result',
          state: 'COMPLETED',
          // Returned in ASC order from the data layer (oldest first).
          images: [
            makeUploadImage('photos/oldest', t1),
            makeUploadImage('photos/middle', t2),
            makeUploadImage('photos/newest', t3),
          ],
        },
      ],
    } as never)

    const meta = await buildResultMetadata('vase')
    // Expect the LATEST photo (t3 / "newest") at the head of the OG list,
    // not the data layer's first element ("oldest").
    expect((meta.openGraph?.images as { url: string }[])[0].url).toContain('photos/newest')
  })
})

// Story 35.4 / FR137 — VIDEO og:image fallback (Cloudinary so_auto +
// S3 null fall-through + entire-deck-VIDEO empty-image elision).
describe('buildJourneyMetadata — VIDEO fallback (Story 35.4 / FR137)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Cloudinary: lead VIDEO row mints a poster URL at SOCIAL_CARD width', async () => {
    mockGetAdapter.mockReturnValue(fakeAdapter as never)
    const date = new Date('2026-04-01T10:00:00Z')
    mockFindJourney.mockResolvedValue({
      name: 'Walkaround',
      description: null,
      journeyGalleryEnabled: true,
      hobby: { name: 'Woodworking', color: 'red', icon: null },
      steps: [{ name: 'Final', images: [makeVideoUploadImage('clips/walk-1', date)], notes: [] }],
    } as never)

    const meta = await buildJourneyMetadata('walk')
    const ogImages = meta.openGraph?.images as { url: string }[]
    expect(ogImages).toHaveLength(1)
    expect(ogImages[0].url).toContain('poster/')
    expect(ogImages[0].url).toContain(String(THUMBNAIL_WIDTH.SOCIAL_CARD))
  })

  it('S3 (null poster): falls through to next eligible IMAGE step', async () => {
    mockGetAdapter.mockReturnValue(s3StyleAdapter as never)
    const olderDate = new Date('2026-04-01T10:00:00Z')
    const newerDate = new Date('2026-04-02T10:00:00Z')
    mockFindJourney.mockResolvedValue({
      name: 'Mixed Deck',
      description: null,
      journeyGalleryEnabled: true,
      hobby: { name: 'Woodworking', color: 'red', icon: null },
      steps: [
        { name: 'Photo', images: [makeUploadImage('photos/older', olderDate)], notes: [] },
        // Newer VIDEO row gets skipped (null poster on S3), fall-through
        // promotes the older IMAGE to the og:image slot.
        { name: 'Video', images: [makeVideoUploadImage('clips/newer', newerDate)], notes: [] },
      ],
    } as never)

    const meta = await buildJourneyMetadata('mixed')
    const ogImages = meta.openGraph?.images as { url: string }[]
    expect(ogImages).toHaveLength(1)
    expect(ogImages[0].url).toContain('photos/older')
    expect(ogImages[0].url).not.toContain('clips/')
  })

  it('S3 entire-deck-VIDEO: omits openGraph.images entirely (no empty-array unfurl)', async () => {
    mockGetAdapter.mockReturnValue(s3StyleAdapter as never)
    mockFindJourney.mockResolvedValue({
      name: 'Video Only',
      description: null,
      journeyGalleryEnabled: true,
      hobby: { name: 'Woodworking', color: 'red', icon: null },
      steps: [
        { name: 'A', images: [makeVideoUploadImage('clips/a')], notes: [] },
        { name: 'B', images: [makeVideoUploadImage('clips/b')], notes: [] },
      ],
    } as never)

    const meta = await buildJourneyMetadata('vid-only')
    // openGraph block still rendered with title/description; images
    // omitted so Slack/LinkedIn fall back to plain unfurl rather than
    // a missing-image card.
    expect(meta.openGraph).toBeDefined()
    expect(meta.openGraph?.images).toBeUndefined()
    expect(meta.twitter?.images).toBeUndefined()
  })
})
