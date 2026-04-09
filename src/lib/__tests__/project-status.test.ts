import { describe, it, expect } from 'vitest'
import { deriveProjectStatus } from '@/lib/project-status'

describe('deriveProjectStatus', () => {
  it('returns NOT_STARTED for empty steps array', () => {
    expect(deriveProjectStatus([])).toBe('NOT_STARTED')
  })

  it('returns NOT_STARTED when all steps are NOT_STARTED', () => {
    expect(deriveProjectStatus([
      { state: 'NOT_STARTED' },
      { state: 'NOT_STARTED' },
    ])).toBe('NOT_STARTED')
  })

  it('returns IN_PROGRESS when any step is IN_PROGRESS', () => {
    expect(deriveProjectStatus([
      { state: 'NOT_STARTED' },
      { state: 'IN_PROGRESS' },
    ])).toBe('IN_PROGRESS')
  })

  it('returns IN_PROGRESS when mix of COMPLETED and NOT_STARTED', () => {
    expect(deriveProjectStatus([
      { state: 'COMPLETED' },
      { state: 'NOT_STARTED' },
    ])).toBe('IN_PROGRESS')
  })

  it('returns BLOCKED when any step is BLOCKED (highest priority)', () => {
    expect(deriveProjectStatus([
      { state: 'IN_PROGRESS' },
      { state: 'BLOCKED' },
      { state: 'COMPLETED' },
    ])).toBe('BLOCKED')
  })

  it('returns BLOCKED even when most steps are completed', () => {
    expect(deriveProjectStatus([
      { state: 'COMPLETED' },
      { state: 'COMPLETED' },
      { state: 'BLOCKED' },
    ])).toBe('BLOCKED')
  })

  it('returns COMPLETED when all steps are COMPLETED', () => {
    expect(deriveProjectStatus([
      { state: 'COMPLETED' },
      { state: 'COMPLETED' },
      { state: 'COMPLETED' },
    ])).toBe('COMPLETED')
  })

  it('returns correct status for single step in each state', () => {
    expect(deriveProjectStatus([{ state: 'NOT_STARTED' }])).toBe('NOT_STARTED')
    expect(deriveProjectStatus([{ state: 'IN_PROGRESS' }])).toBe('IN_PROGRESS')
    expect(deriveProjectStatus([{ state: 'COMPLETED' }])).toBe('COMPLETED')
    expect(deriveProjectStatus([{ state: 'BLOCKED' }])).toBe('BLOCKED')
  })
})
