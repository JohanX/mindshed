import { describe, it, expect } from 'vitest'
import { createNoteSchema } from '../schemas/note'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'

describe('createNoteSchema', () => {
  it('accepts valid input', () => {
    const result = createNoteSchema.safeParse({ stepId: validUuid, text: 'A note' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid stepId', () => {
    const result = createNoteSchema.safeParse({ stepId: 'bad', text: 'A note' })
    expect(result.success).toBe(false)
  })

  it('rejects empty text', () => {
    const result = createNoteSchema.safeParse({ stepId: validUuid, text: '' })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only text', () => {
    const result = createNoteSchema.safeParse({ stepId: validUuid, text: '   ' })
    expect(result.success).toBe(false)
  })

  it('trims whitespace from text', () => {
    const result = createNoteSchema.safeParse({ stepId: validUuid, text: '  Hello  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.text).toBe('Hello')
    }
  })

  it('accepts text at max length (2000 chars)', () => {
    const longText = 'a'.repeat(2000)
    const result = createNoteSchema.safeParse({ stepId: validUuid, text: longText })
    expect(result.success).toBe(true)
  })

  it('rejects text exceeding 2000 chars', () => {
    const longText = 'a'.repeat(2001)
    const result = createNoteSchema.safeParse({ stepId: validUuid, text: longText })
    expect(result.success).toBe(false)
  })

  it('rejects missing stepId', () => {
    const result = createNoteSchema.safeParse({ text: 'A note' })
    expect(result.success).toBe(false)
  })

  it('rejects missing text', () => {
    const result = createNoteSchema.safeParse({ stepId: validUuid })
    expect(result.success).toBe(false)
  })
})
