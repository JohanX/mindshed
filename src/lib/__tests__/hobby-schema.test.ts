import { describe, it, expect } from 'vitest'
import { createHobbySchema, HOBBY_COLORS } from '../schemas/hobby'

describe('createHobbySchema', () => {
  it('rejects empty name', () => {
    const result = createHobbySchema.safeParse({ name: '', color: HOBBY_COLORS[0].value })
    expect(result.success).toBe(false)
  })

  it('rejects invalid color value', () => {
    const result = createHobbySchema.safeParse({ name: 'Test', color: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('accepts valid input with all fields', () => {
    const result = createHobbySchema.safeParse({
      name: 'Woodworking',
      color: HOBBY_COLORS[0].value,
      icon: 'hammer',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid input without icon', () => {
    const result = createHobbySchema.safeParse({
      name: 'Pottery',
      color: HOBBY_COLORS[3].value,
    })
    expect(result.success).toBe(true)
  })

  it('trims whitespace from name', () => {
    const result = createHobbySchema.safeParse({
      name: '  Woodworking  ',
      color: HOBBY_COLORS[0].value,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Woodworking')
    }
  })

  it('rejects name over 100 characters', () => {
    const result = createHobbySchema.safeParse({
      name: 'a'.repeat(101),
      color: HOBBY_COLORS[0].value,
    })
    expect(result.success).toBe(false)
  })
})
