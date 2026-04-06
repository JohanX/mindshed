import { describe, it, expect } from 'vitest'
import { getCurrentStep } from '@/lib/project-utils'

describe('getCurrentStep', () => {
  it('returns first IN_PROGRESS step', () => {
    const steps = [
      { name: 'Done', state: 'COMPLETED', sortOrder: 0 },
      { name: 'Doing', state: 'IN_PROGRESS', sortOrder: 1 },
      { name: 'Todo', state: 'NOT_STARTED', sortOrder: 2 },
    ]
    const result = getCurrentStep(steps)
    expect(result).toEqual({ name: 'Doing', state: 'IN_PROGRESS' })
  })

  it('returns first NOT_STARTED step when no IN_PROGRESS exists', () => {
    const steps = [
      { name: 'Done', state: 'COMPLETED', sortOrder: 0 },
      { name: 'Next', state: 'NOT_STARTED', sortOrder: 1 },
      { name: 'Later', state: 'NOT_STARTED', sortOrder: 2 },
    ]
    const result = getCurrentStep(steps)
    expect(result).toEqual({ name: 'Next', state: 'NOT_STARTED' })
  })

  it('prefers IN_PROGRESS over NOT_STARTED even if NOT_STARTED has lower sortOrder', () => {
    const steps = [
      { name: 'Skipped', state: 'NOT_STARTED', sortOrder: 0 },
      { name: 'Active', state: 'IN_PROGRESS', sortOrder: 1 },
    ]
    const result = getCurrentStep(steps)
    expect(result).toEqual({ name: 'Active', state: 'IN_PROGRESS' })
  })

  it('returns null when all steps are COMPLETED', () => {
    const steps = [
      { name: 'A', state: 'COMPLETED', sortOrder: 0 },
      { name: 'B', state: 'COMPLETED', sortOrder: 1 },
    ]
    const result = getCurrentStep(steps)
    expect(result).toBeNull()
  })

  it('returns null for empty steps array', () => {
    const result = getCurrentStep([])
    expect(result).toBeNull()
  })

  it('returns null when only BLOCKED steps remain', () => {
    const steps = [
      { name: 'Done', state: 'COMPLETED', sortOrder: 0 },
      { name: 'Stuck', state: 'BLOCKED', sortOrder: 1 },
    ]
    const result = getCurrentStep(steps)
    expect(result).toBeNull()
  })
})
