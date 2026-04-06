import { describe, it, expect } from 'vitest'
import { createHobbySchema, updateHobbySchema, reorderHobbiesSchema, HOBBY_COLORS } from '../schemas/hobby'

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

describe('updateHobbySchema', () => {
  it('rejects missing id', () => {
    const result = updateHobbySchema.safeParse({
      name: 'Test',
      color: HOBBY_COLORS[0].value,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID', () => {
    const result = updateHobbySchema.safeParse({
      id: 'not-a-uuid',
      name: 'Test',
      color: HOBBY_COLORS[0].value,
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = updateHobbySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: '',
      color: HOBBY_COLORS[0].value,
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid input', () => {
    const result = updateHobbySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Updated Hobby',
      color: HOBBY_COLORS[2].value,
      icon: 'palette',
    })
    expect(result.success).toBe(true)
  })
})

describe('reorderHobbiesSchema', () => {
  it('rejects empty array', () => {
    const result = reorderHobbiesSchema.safeParse({ orderedIds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects array with invalid UUIDs', () => {
    const result = reorderHobbiesSchema.safeParse({ orderedIds: ['not-a-uuid'] })
    expect(result.success).toBe(false)
  })

  it('accepts valid array of UUIDs', () => {
    const result = reorderHobbiesSchema.safeParse({
      orderedIds: [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ],
    })
    expect(result.success).toBe(true)
  })
})
