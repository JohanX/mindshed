import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all 3 action modules — the unified uploader imports from each.
vi.mock('@/actions/image', () => ({
  addStepImage: vi.fn().mockResolvedValue({ success: true, data: { id: 'step-img' } }),
  uploadImageCloudinary: vi.fn().mockResolvedValue({ success: true, data: { id: 'step-cl' } }),
}))
vi.mock('@/actions/inventory-image', () => ({
  addInventoryItemImage: vi.fn().mockResolvedValue({ success: true, data: { id: 'inv-img' } }),
  uploadInventoryItemImageCloudinary: vi
    .fn()
    .mockResolvedValue({ success: true, data: { id: 'inv-cl' } }),
}))
vi.mock('@/actions/idea-image', () => ({
  addIdeaImage: vi.fn().mockResolvedValue({ success: true, data: { id: 'idea-img' } }),
  uploadIdeaImageCloudinary: vi.fn().mockResolvedValue({ success: true, data: { id: 'idea-cl' } }),
}))

import { uploadImage, type ImageKind } from '@/lib/upload-image'
import { uploadImageToStorage } from '@/lib/upload-image'
import { uploadInventoryImageToStorage } from '@/lib/upload-inventory-image'
import { uploadIdeaImageToStorage } from '@/lib/upload-idea-image'
import { addStepImage, uploadImageCloudinary } from '@/actions/image'
import {
  addInventoryItemImage,
  uploadInventoryItemImageCloudinary,
} from '@/actions/inventory-image'
import { addIdeaImage, uploadIdeaImageCloudinary } from '@/actions/idea-image'

function makeFile(name: string, type: string, size: number): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

interface KindFixture {
  kind: ImageKind
  parentField: string
  expectedDbAction: ReturnType<typeof vi.fn>
  expectedCloudinaryAction: ReturnType<typeof vi.fn>
}

const KINDS: KindFixture[] = [
  {
    kind: 'step',
    parentField: 'stepId',
    expectedDbAction: vi.mocked(addStepImage),
    expectedCloudinaryAction: vi.mocked(uploadImageCloudinary),
  },
  {
    kind: 'inventory',
    parentField: 'inventoryItemId',
    expectedDbAction: vi.mocked(addInventoryItemImage),
    expectedCloudinaryAction: vi.mocked(uploadInventoryItemImageCloudinary),
  },
  {
    kind: 'idea',
    parentField: 'ideaId',
    expectedDbAction: vi.mocked(addIdeaImage),
    expectedCloudinaryAction: vi.mocked(uploadIdeaImageCloudinary),
  },
]

describe('uploadImage (unified)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    delete process.env.NEXT_PUBLIC_IMAGE_PROVIDER
  })

  it.each(KINDS)('rejects files over 10MB ($kind)', async ({ kind }) => {
    const file = makeFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024)
    const result = await uploadImage({ kind, parentId: 'p1', file })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('10 MB')
  })

  it.each(KINDS)('rejects invalid content types ($kind)', async ({ kind }) => {
    const file = makeFile('doc.pdf', 'application/pdf', 1000)
    const result = await uploadImage({ kind, parentId: 'p1', file })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('JPEG')
  })

  it.each(KINDS)(
    'sends presign request with correct field + uploads to S3 + records DB ($kind)',
    async ({ kind, parentField, expectedDbAction }) => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ url: 'https://s3/put', key: 'k1' }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }))

      const file = makeFile('photo.jpg', 'image/jpeg', 5000)
      const result = await uploadImage({ kind, parentId: 'p-' + kind, file })

      expect(result.success).toBe(true)
      if (result.success) expect(result.key).toBe('k1')

      // First call is the presign request — body should carry the parent id
      // under the strategy's discriminator field.
      const presignCall = mockFetch.mock.calls[0]
      expect(presignCall[0]).toBe('/api/upload/presign')
      const body = JSON.parse((presignCall[1] as RequestInit).body as string)
      expect(body[parentField]).toBe('p-' + kind)

      // DB action received the unified shape under the kind-specific field name.
      expect(expectedDbAction).toHaveBeenCalledTimes(1)
    },
  )

  it.each(KINDS)('returns error when presign fails non-fallback ($kind)', async ({ kind }) => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }))
    const file = makeFile('photo.jpg', 'image/jpeg', 5000)
    const result = await uploadImage({ kind, parentId: 'p1', file })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/upload URL/i)
  })

  it.each(KINDS)(
    'falls back to Cloudinary when presign 404s ($kind)',
    async ({ kind, expectedCloudinaryAction }) => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }))
      const file = makeFile('photo.jpg', 'image/jpeg', 5000)
      const result = await uploadImage({ kind, parentId: 'p1', file })
      expect(result.success).toBe(true)
      expect(expectedCloudinaryAction).toHaveBeenCalledTimes(1)
    },
  )

  it.each(KINDS)(
    'skips presign and goes direct to Cloudinary when provider=cloudinary ($kind)',
    async ({ kind, expectedCloudinaryAction }) => {
      process.env.NEXT_PUBLIC_IMAGE_PROVIDER = 'cloudinary'
      const file = makeFile('photo.jpg', 'image/jpeg', 5000)
      const result = await uploadImage({ kind, parentId: 'p1', file })
      expect(result.success).toBe(true)
      expect(expectedCloudinaryAction).toHaveBeenCalledTimes(1)
      // No presign call should have happened.
      expect(global.fetch).not.toHaveBeenCalled()
    },
  )

  // Story 35.2 / FR134 — video MIMEs are step-only.
  describe('Story 35.2 — video MIMEs (step-only)', () => {
    it.each(['video/mp4', 'video/quicktime', 'video/webm'])(
      'step kind accepts %s with duration 30s',
      async (mime) => {
        const mockFetch = vi.mocked(global.fetch)
        mockFetch
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ url: 'https://s3/put', key: 'k1' }), { status: 200 }),
          )
          .mockResolvedValueOnce(new Response(null, { status: 200 }))
        const file = makeFile('clip.mp4', mime, 5 * 1024 * 1024)
        const result = await uploadImage({
          kind: 'step',
          parentId: 'p1',
          file,
          durationSeconds: 30,
        })
        expect(result.success).toBe(true)
        if (result.success) expect(result.key).toBe('k1')
      },
    )

    it.each(['idea', 'inventory'] as const)(
      '%s kind rejects video/mp4 (kind-mismatch)',
      async (kind) => {
        const file = makeFile('clip.mp4', 'video/mp4', 5 * 1024 * 1024)
        const result = await uploadImage({ kind, parentId: 'p1', file, durationSeconds: 30 })
        expect(result.success).toBe(false)
        if (!result.success) expect(result.error).toContain('JPEG')
      },
    )

    it('step kind rejects video over 60 MB', async () => {
      const file = makeFile('big.mp4', 'video/mp4', 61 * 1024 * 1024)
      const result = await uploadImage({
        kind: 'step',
        parentId: 'p1',
        file,
        durationSeconds: 30,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toContain('60 MB')
    })

    it('step kind rejects video missing durationSeconds', async () => {
      const file = makeFile('clip.mp4', 'video/mp4', 5 * 1024 * 1024)
      const result = await uploadImage({ kind: 'step', parentId: 'p1', file })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toContain('1 and 60')
    })

    it('step kind rejects video with duration > 60', async () => {
      const file = makeFile('clip.mp4', 'video/mp4', 5 * 1024 * 1024)
      const result = await uploadImage({
        kind: 'step',
        parentId: 'p1',
        file,
        durationSeconds: 61,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toContain('1 and 60')
    })

    it('step kind rejects video with duration < 1', async () => {
      const file = makeFile('clip.mp4', 'video/mp4', 5 * 1024 * 1024)
      const result = await uploadImage({
        kind: 'step',
        parentId: 'p1',
        file,
        durationSeconds: 0,
      })
      expect(result.success).toBe(false)
    })

    it('step kind propagates mediaType:VIDEO + durationSeconds through to addStepImage', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ url: 'https://s3/put', key: 'k1' }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
      const file = makeFile('clip.mp4', 'video/mp4', 5 * 1024 * 1024)
      await uploadImage({
        kind: 'step',
        parentId: 'p1',
        file,
        durationSeconds: 42,
      })
      const dbCall = vi.mocked(addStepImage).mock.calls[0][0]
      expect(dbCall.mediaType).toBe('VIDEO')
      expect(dbCall.durationSeconds).toBe(42)
      expect(dbCall.contentType).toBe('video/mp4')
    })

    it('step kind defaults to mediaType:IMAGE + durationSeconds:null for image uploads', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ url: 'https://s3/put', key: 'k1' }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
      const file = makeFile('photo.jpg', 'image/jpeg', 5000)
      await uploadImage({ kind: 'step', parentId: 'p1', file })
      const dbCall = vi.mocked(addStepImage).mock.calls[0][0]
      expect(dbCall.mediaType).toBe('IMAGE')
      expect(dbCall.durationSeconds).toBeNull()
    })
  })

  // Story 35.5 / FR138 — Cloudinary signed direct-upload for VIDEO.
  // The orchestrator must branch only on VIDEO + cloudinary; IMAGE +
  // cloudinary keeps the existing Server Action path, and any provider
  // with S3 keeps the presign path.
  describe('Story 35.5 — Cloudinary direct-upload for VIDEO', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_IMAGE_PROVIDER = 'cloudinary'
    })

    function mockSignResponse(): Response {
      return new Response(
        JSON.stringify({
          timestamp: 1700000000,
          signature: 'fake-sig',
          apiKey: 'fake-key',
          cloudName: 'fake-cloud',
          folder: 'steps/p1',
          resourceType: 'video',
        }),
        { status: 200 },
      )
    }

    function mockCloudinaryResponse(overrides: Record<string, unknown> = {}): Response {
      return new Response(
        JSON.stringify({
          public_id: 'steps/p1/video-xyz',
          secure_url:
            'https://res.cloudinary.com/fake/video/upload/v1700000000/steps/p1/video-xyz.mp4',
          duration: 14.234,
          bytes: 7864320,
          format: 'mp4',
          resource_type: 'video',
          ...overrides,
        }),
        { status: 200 },
      )
    }

    it('VIDEO + cloudinary goes through the direct-upload path', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(mockSignResponse())
        .mockResolvedValueOnce(mockCloudinaryResponse())
      const file = makeFile('clip.mp4', 'video/mp4', 7 * 1024 * 1024)

      const result = await uploadImage({
        kind: 'step',
        parentId: 'p1',
        file,
        durationSeconds: 14,
      })

      expect(result.success).toBe(true)
      if (result.success) expect(result.key).toBe('steps/p1/video-xyz')

      // Two fetches: sign endpoint + Cloudinary upload endpoint.
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const signCall = mockFetch.mock.calls[0]
      expect(signCall[0]).toBe('/api/upload/cloudinary-sign')
      const signBody = JSON.parse((signCall[1] as RequestInit).body as string)
      expect(signBody).toEqual({ folder: 'steps/p1', resourceType: 'video' })

      const cloudinaryCall = mockFetch.mock.calls[1]
      expect(cloudinaryCall[0]).toBe('https://api.cloudinary.com/v1_1/fake-cloud/video/upload')

      // The Server Action Cloudinary uploader must NOT have been called.
      expect(vi.mocked(uploadImageCloudinary)).not.toHaveBeenCalled()
    })

    it('forwards Cloudinary response fields to addStepImage', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(mockSignResponse())
        .mockResolvedValueOnce(mockCloudinaryResponse())
      const file = makeFile('clip.mp4', 'video/mp4', 7 * 1024 * 1024)

      await uploadImage({ kind: 'step', parentId: 'p1', file, durationSeconds: 14 })

      const dbCall = vi.mocked(addStepImage).mock.calls[0][0]
      expect(dbCall.storageKey).toBe('steps/p1/video-xyz')
      expect(dbCall.mediaType).toBe('VIDEO')
      // duration: 14.234 → Math.round → 14
      expect(dbCall.durationSeconds).toBe(14)
      // Cloudinary `format: 'mp4'` → contentType 'video/mp4'
      expect(dbCall.contentType).toBe('video/mp4')
      expect(dbCall.sizeBytes).toBe(7864320)
    })

    // Code-review patch (Blind/Edge HIGH-2): Cloudinary boundary durations
    // (0.4 → 0; 60.7 → 61) would fail the schema's 1-60 range after a
    // successful upload, orphaning the bytes. Orchestrator clamps.
    it('clamps Cloudinary duration to 1-60 when boundary values are reported', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(mockSignResponse())
        .mockResolvedValueOnce(mockCloudinaryResponse({ duration: 0.4 }))
      const file = makeFile('short.mp4', 'video/mp4', 5 * 1024 * 1024)
      await uploadImage({ kind: 'step', parentId: 'p1', file, durationSeconds: 1 })
      expect(vi.mocked(addStepImage).mock.calls[0][0].durationSeconds).toBe(1)
    })

    it('clamps Cloudinary duration to 60 when reported value > 60', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(mockSignResponse())
        .mockResolvedValueOnce(mockCloudinaryResponse({ duration: 60.7 }))
      const file = makeFile('long.mp4', 'video/mp4', 5 * 1024 * 1024)
      await uploadImage({ kind: 'step', parentId: 'p1', file, durationSeconds: 60 })
      expect(vi.mocked(addStepImage).mock.calls[0][0].durationSeconds).toBe(60)
    })

    // Code-review patch (Blind/Edge HIGH-3): if Cloudinary omits `duration`
    // in the response, fall back to the client-measured durationSeconds
    // instead of sending null (which would fail schema validation for VIDEO
    // and orphan the bytes).
    it('falls back to client durationSeconds when Cloudinary omits duration', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce(mockSignResponse()).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            public_id: 'steps/p1/no-duration',
            secure_url: 'https://res.cloudinary.com/.../no-duration.mp4',
            // duration intentionally omitted
            bytes: 1000,
            format: 'mp4',
            resource_type: 'video',
          }),
          { status: 200 },
        ),
      )
      const file = makeFile('clip.mp4', 'video/mp4', 5 * 1024 * 1024)
      await uploadImage({ kind: 'step', parentId: 'p1', file, durationSeconds: 42 })
      expect(vi.mocked(addStepImage).mock.calls[0][0].durationSeconds).toBe(42)
    })

    it('maps Cloudinary format=mov to contentType video/quicktime', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(mockSignResponse())
        .mockResolvedValueOnce(
          mockCloudinaryResponse({ public_id: 'steps/p1/mov-xyz', format: 'mov' }),
        )
      const file = makeFile('clip.mov', 'video/quicktime', 5 * 1024 * 1024)

      await uploadImage({ kind: 'step', parentId: 'p1', file, durationSeconds: 14 })

      const dbCall = vi.mocked(addStepImage).mock.calls[0][0]
      expect(dbCall.contentType).toBe('video/quicktime')
    })

    it('returns error when sign endpoint fails', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }))
      const file = makeFile('clip.mp4', 'video/mp4', 7 * 1024 * 1024)

      const result = await uploadImage({
        kind: 'step',
        parentId: 'p1',
        file,
        durationSeconds: 14,
      })
      expect(result.success).toBe(false)
      // Only the sign call happened — no Cloudinary upload, no DB record.
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(vi.mocked(addStepImage)).not.toHaveBeenCalled()
    })

    it('returns error when Cloudinary upload fails', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(mockSignResponse())
        .mockResolvedValueOnce(new Response(null, { status: 400 }))
      const file = makeFile('clip.mp4', 'video/mp4', 7 * 1024 * 1024)

      const result = await uploadImage({
        kind: 'step',
        parentId: 'p1',
        file,
        durationSeconds: 14,
      })
      expect(result.success).toBe(false)
      // No DB record on Cloudinary failure.
      expect(vi.mocked(addStepImage)).not.toHaveBeenCalled()
    })

    it('propagates addStepImage failure (orphan cleanup is the action`s responsibility)', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(mockSignResponse())
        .mockResolvedValueOnce(mockCloudinaryResponse())
      vi.mocked(addStepImage).mockResolvedValueOnce({
        success: false,
        error: 'STEP_IMAGE_LIMIT_REACHED',
      })
      const file = makeFile('clip.mp4', 'video/mp4', 7 * 1024 * 1024)

      const result = await uploadImage({
        kind: 'step',
        parentId: 'p1',
        file,
        durationSeconds: 14,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toBe('STEP_IMAGE_LIMIT_REACHED')
      // The orchestrator did NOT call deleteObject directly — that would
      // be impossible from a browser context. `addStepImage` handles its
      // own validation/DB-failure orphan cleanup server-side.
    })

    it('IMAGE + cloudinary continues on the Server Action path (regression guard)', async () => {
      const file = makeFile('photo.jpg', 'image/jpeg', 5000)

      const result = await uploadImage({ kind: 'step', parentId: 'p1', file })
      expect(result.success).toBe(true)

      // Server Action path was hit — no fetch to sign endpoint, no
      // fetch to Cloudinary directly.
      expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
      expect(vi.mocked(uploadImageCloudinary)).toHaveBeenCalledTimes(1)
    })

    it('VIDEO + s3 stays on the presign path (regression guard)', async () => {
      // S3 mode — presign + PUT. No direct-upload, no Server Action.
      process.env.NEXT_PUBLIC_IMAGE_PROVIDER = 's3'

      const mockFetch = vi.mocked(global.fetch)
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ url: 'https://s3/put', key: 'k1' }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
      const file = makeFile('clip.mp4', 'video/mp4', 7 * 1024 * 1024)

      const result = await uploadImage({
        kind: 'step',
        parentId: 'p1',
        file,
        durationSeconds: 14,
      })
      expect(result.success).toBe(true)
      expect(mockFetch.mock.calls[0][0]).toBe('/api/upload/presign')
      // Server Action Cloudinary path was NOT touched.
      expect(vi.mocked(uploadImageCloudinary)).not.toHaveBeenCalled()
    })
  })
})

describe('Backward-compat wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    delete process.env.NEXT_PUBLIC_IMAGE_PROVIDER
  })

  it('uploadImageToStorage (step) preserves the stepId field signature', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://s3/put', key: 'k1' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const file = makeFile('p.jpg', 'image/jpeg', 1000)
    const result = await uploadImageToStorage({ stepId: 's1', file })
    expect(result.success).toBe(true)
  })

  it('uploadInventoryImageToStorage preserves the inventoryItemId signature', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://s3/put', key: 'k1' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const file = makeFile('p.jpg', 'image/jpeg', 1000)
    const result = await uploadInventoryImageToStorage({ inventoryItemId: 'i1', file })
    expect(result.success).toBe(true)
  })

  it('uploadIdeaImageToStorage preserves the ideaId signature', async () => {
    const mockFetch = vi.mocked(global.fetch)
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://s3/put', key: 'k1' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const file = makeFile('p.jpg', 'image/jpeg', 1000)
    const result = await uploadIdeaImageToStorage({ ideaId: 'i1', file })
    expect(result.success).toBe(true)
  })
})
