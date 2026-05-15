import { describe, it, expect } from 'vitest'
import { addImageLinkSchema, addStepImageSchema } from '../schemas/image'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('addImageLinkSchema', () => {
  it('accepts valid https URL', () => {
    const result = addImageLinkSchema.safeParse({
      stepId: VALID_UUID,
      url: 'https://example.com/image.jpg',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid http URL', () => {
    const result = addImageLinkSchema.safeParse({
      stepId: VALID_UUID,
      url: 'http://example.com/photo.png',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID for stepId', () => {
    const result = addImageLinkSchema.safeParse({
      stepId: 'not-a-uuid',
      url: 'https://example.com/image.jpg',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-URL string', () => {
    const result = addImageLinkSchema.safeParse({
      stepId: VALID_UUID,
      url: 'not a url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects ftp:// URLs', () => {
    const result = addImageLinkSchema.safeParse({
      stepId: VALID_UUID,
      url: 'ftp://example.com/image.jpg',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty URL', () => {
    const result = addImageLinkSchema.safeParse({
      stepId: VALID_UUID,
      url: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    const result = addImageLinkSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

const validUploadInput = {
  stepId: VALID_UUID,
  storageKey: 'steps/abc/def.jpg',
  originalFilename: 'photo.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 12345,
}

describe('addStepImageSchema', () => {
  it('accepts valid input', () => {
    const result = addStepImageSchema.safeParse(validUploadInput)
    expect(result.success).toBe(true)
  })

  it('rejects invalid stepId', () => {
    const result = addStepImageSchema.safeParse({ ...validUploadInput, stepId: 'bad' })
    expect(result.success).toBe(false)
  })

  it('rejects empty storageKey', () => {
    const result = addStepImageSchema.safeParse({ ...validUploadInput, storageKey: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty originalFilename', () => {
    const result = addStepImageSchema.safeParse({ ...validUploadInput, originalFilename: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty contentType', () => {
    const result = addStepImageSchema.safeParse({ ...validUploadInput, contentType: '' })
    expect(result.success).toBe(false)
  })

  it('rejects zero sizeBytes', () => {
    const result = addStepImageSchema.safeParse({ ...validUploadInput, sizeBytes: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative sizeBytes', () => {
    const result = addStepImageSchema.safeParse({ ...validUploadInput, sizeBytes: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer sizeBytes', () => {
    const result = addStepImageSchema.safeParse({ ...validUploadInput, sizeBytes: 1.5 })
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    const result = addStepImageSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects missing stepId', () => {
    const result = addStepImageSchema.safeParse({
      storageKey: 'steps/abc/def.jpg',
      originalFilename: 'photo.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 12345,
    })
    expect(result.success).toBe(false)
  })

  // Story 35.2 / FR134 — video MIMEs + duration bounds + mediaType invariant
  describe('Story 35.2 — video upload validation', () => {
    // storageKey regex requires hex-only path segments — the original
    // `clip.mp4` literal fails because `l`/`i`/`p` aren't in [a-f0-9-].
    const validVideoInput = {
      stepId: VALID_UUID,
      storageKey: 'steps/abc/def01.mp4',
      originalFilename: 'clip.mp4',
      contentType: 'video/mp4',
      sizeBytes: 5 * 1024 * 1024,
      mediaType: 'VIDEO' as const,
      durationSeconds: 30,
    }

    it('accepts valid VIDEO input with duration in range', () => {
      const result = addStepImageSchema.safeParse(validVideoInput)
      expect(result.success).toBe(true)
    })

    it('accepts video/quicktime', () => {
      const result = addStepImageSchema.safeParse({
        ...validVideoInput,
        contentType: 'video/quicktime',
        originalFilename: 'clip.mov',
      })
      expect(result.success).toBe(true)
    })

    it('accepts video/webm', () => {
      const result = addStepImageSchema.safeParse({
        ...validVideoInput,
        contentType: 'video/webm',
        originalFilename: 'clip.webm',
      })
      expect(result.success).toBe(true)
    })

    it('accepts duration = 1', () => {
      const result = addStepImageSchema.safeParse({ ...validVideoInput, durationSeconds: 1 })
      expect(result.success).toBe(true)
    })

    it('accepts duration = 60', () => {
      const result = addStepImageSchema.safeParse({ ...validVideoInput, durationSeconds: 60 })
      expect(result.success).toBe(true)
    })

    it('rejects duration = 0', () => {
      const result = addStepImageSchema.safeParse({ ...validVideoInput, durationSeconds: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects duration = 61', () => {
      const result = addStepImageSchema.safeParse({ ...validVideoInput, durationSeconds: 61 })
      expect(result.success).toBe(false)
    })

    it('rejects negative duration', () => {
      const result = addStepImageSchema.safeParse({ ...validVideoInput, durationSeconds: -5 })
      expect(result.success).toBe(false)
    })

    it('rejects non-integer duration', () => {
      const result = addStepImageSchema.safeParse({ ...validVideoInput, durationSeconds: 30.5 })
      expect(result.success).toBe(false)
    })

    it('rejects VIDEO with null duration', () => {
      const result = addStepImageSchema.safeParse({ ...validVideoInput, durationSeconds: null })
      expect(result.success).toBe(false)
    })

    it('rejects IMAGE with non-null duration', () => {
      const result = addStepImageSchema.safeParse({
        ...validUploadInput,
        mediaType: 'IMAGE',
        durationSeconds: 5,
      })
      expect(result.success).toBe(false)
    })

    it('rejects VIDEO with image contentType (e.g. mediaType:VIDEO + contentType:image/jpeg)', () => {
      const result = addStepImageSchema.safeParse({
        ...validVideoInput,
        contentType: 'image/jpeg',
      })
      expect(result.success).toBe(false)
    })

    it('rejects IMAGE with video contentType (e.g. mediaType:IMAGE + contentType:video/mp4)', () => {
      const result = addStepImageSchema.safeParse({
        ...validUploadInput,
        contentType: 'video/mp4',
        mediaType: 'IMAGE',
        durationSeconds: null,
      })
      expect(result.success).toBe(false)
    })

    it('rejects VIDEO over 60 MB', () => {
      const result = addStepImageSchema.safeParse({
        ...validVideoInput,
        sizeBytes: 61 * 1024 * 1024,
      })
      expect(result.success).toBe(false)
    })

    it('accepts VIDEO at 60 MB boundary', () => {
      const result = addStepImageSchema.safeParse({
        ...validVideoInput,
        sizeBytes: 60 * 1024 * 1024,
      })
      expect(result.success).toBe(true)
    })

    it('rejects IMAGE over 10 MB', () => {
      const result = addStepImageSchema.safeParse({
        ...validUploadInput,
        sizeBytes: 11 * 1024 * 1024,
      })
      expect(result.success).toBe(false)
    })

    it('IMAGE defaults to mediaType=IMAGE + durationSeconds=null when omitted', () => {
      const result = addStepImageSchema.safeParse(validUploadInput)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.mediaType).toBe('IMAGE')
        expect(result.data.durationSeconds).toBeNull()
      }
    })
  })
})
