import { describe, it, expect } from 'vitest'
import { createProjectSchema } from '../schemas/project'

describe('createProjectSchema', () => {
  it('rejects empty project name', () => {
    const result = createProjectSchema.safeParse({
      name: '',
      hobbyId: '550e8400-e29b-41d4-a716-446655440000',
      steps: [{ name: 'Step 1' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty steps array', () => {
    const result = createProjectSchema.safeParse({
      name: 'Test Project',
      hobbyId: '550e8400-e29b-41d4-a716-446655440000',
      steps: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid hobbyId', () => {
    const result = createProjectSchema.safeParse({
      name: 'Test Project',
      hobbyId: 'not-a-uuid',
      steps: [{ name: 'Step 1' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects step with empty name', () => {
    const result = createProjectSchema.safeParse({
      name: 'Test Project',
      hobbyId: '550e8400-e29b-41d4-a716-446655440000',
      steps: [{ name: '' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid input with multiple steps', () => {
    const result = createProjectSchema.safeParse({
      name: 'Walnut Side Table',
      hobbyId: '550e8400-e29b-41d4-a716-446655440000',
      steps: [{ name: 'Design' }, { name: 'Cut' }, { name: 'Assembly' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid input with optional description', () => {
    const result = createProjectSchema.safeParse({
      name: 'Test',
      description: 'A test project',
      hobbyId: '550e8400-e29b-41d4-a716-446655440000',
      steps: [{ name: 'Step 1' }],
    })
    expect(result.success).toBe(true)
  })

  it('trims whitespace from names', () => {
    const result = createProjectSchema.safeParse({
      name: '  Trimmed  ',
      hobbyId: '550e8400-e29b-41d4-a716-446655440000',
      steps: [{ name: '  Step  ' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Trimmed')
      expect(result.data.steps[0].name).toBe('Step')
    }
  })
})
