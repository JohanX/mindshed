import { describe, it, expect } from 'vitest'
import { createIdeaSchema } from '../schemas/idea'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'

describe('createIdeaSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: 'Build a shelf',
      description: 'A floating shelf for the living room',
      referenceLink: 'https://example.com/shelf',
    })
    expect(result.success).toBe(true)
  })

  it('accepts title only (minimal input)', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: 'Quick thought',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only title', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('trims whitespace from title', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: '  Build a shelf  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Build a shelf')
    }
  })

  it('rejects title over 200 characters', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid hobbyId', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: 'not-a-uuid',
      title: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('transforms empty string referenceLink to null', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: 'Test',
      referenceLink: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.referenceLink).toBeNull()
    }
  })

  it('transforms empty string description to null', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: 'Test',
      description: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeNull()
    }
  })

  it('rejects invalid URL in referenceLink', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: 'Test',
      referenceLink: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid URL in referenceLink', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: 'Test',
      referenceLink: 'https://example.com',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.referenceLink).toBe('https://example.com')
    }
  })

  it('rejects description over 2000 characters', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: 'Test',
      description: 'a'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('accepts null referenceLink', () => {
    const result = createIdeaSchema.safeParse({
      hobbyId: validUuid,
      title: 'Test',
      referenceLink: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.referenceLink).toBeNull()
    }
  })
})
