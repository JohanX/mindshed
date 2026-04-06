import { describe, it, expect } from 'vitest'
import { createBlockerSchema } from '../schemas/blocker'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('createBlockerSchema', () => {
  it('accepts valid input', () => {
    const result = createBlockerSchema.safeParse({
      stepId: VALID_UUID,
      description: 'Waiting for parts to arrive',
    })
    expect(result.success).toBe(true)
  })

  it('trims description whitespace', () => {
    const result = createBlockerSchema.safeParse({
      stepId: VALID_UUID,
      description: '  Needs glue to dry  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('Needs glue to dry')
    }
  })

  it('rejects empty description', () => {
    const result = createBlockerSchema.safeParse({
      stepId: VALID_UUID,
      description: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only description', () => {
    const result = createBlockerSchema.safeParse({
      stepId: VALID_UUID,
      description: '   ',
    })
    expect(result.success).toBe(false)
  })

  it('rejects description over 500 characters', () => {
    const result = createBlockerSchema.safeParse({
      stepId: VALID_UUID,
      description: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('accepts description at exactly 500 characters', () => {
    const result = createBlockerSchema.safeParse({
      stepId: VALID_UUID,
      description: 'x'.repeat(500),
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid stepId', () => {
    const result = createBlockerSchema.safeParse({
      stepId: 'not-a-uuid',
      description: 'Valid description',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing stepId', () => {
    const result = createBlockerSchema.safeParse({
      description: 'Valid description',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing description', () => {
    const result = createBlockerSchema.safeParse({
      stepId: VALID_UUID,
    })
    expect(result.success).toBe(false)
  })
})
