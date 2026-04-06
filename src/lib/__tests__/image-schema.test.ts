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
})
