import { describe, it, expect } from 'vitest'
import { createStepSchema, updateStepSchema, updateStepStateSchema } from '../schemas/step'

describe('createStepSchema', () => {
  it('rejects empty name', () => {
    const result = createStepSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid input', () => {
    const result = createStepSchema.safeParse({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Sand',
    })
    expect(result.success).toBe(true)
  })
})

describe('updateStepSchema', () => {
  it('rejects invalid UUID', () => {
    const result = updateStepSchema.safeParse({ id: 'bad', name: 'Test' })
    expect(result.success).toBe(false)
  })

  it('accepts valid input', () => {
    const result = updateStepSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Updated',
    })
    expect(result.success).toBe(true)
  })
})

describe('updateStepStateSchema', () => {
  it('rejects invalid state', () => {
    const result = updateStepStateSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('accepts COMPLETED state', () => {
    const result = updateStepStateSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'COMPLETED',
    })
    expect(result.success).toBe(true)
  })
})
