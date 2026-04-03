import { describe, it, expect } from 'vitest'
import { STEP_STATES, STEP_STATE_CONFIG, type StepState } from '../step-states'

describe('STEP_STATES', () => {
  it('has all 4 step states', () => {
    expect(Object.keys(STEP_STATES)).toHaveLength(4)
    expect(STEP_STATES.NOT_STARTED).toBe('NOT_STARTED')
    expect(STEP_STATES.IN_PROGRESS).toBe('IN_PROGRESS')
    expect(STEP_STATES.COMPLETED).toBe('COMPLETED')
    expect(STEP_STATES.BLOCKED).toBe('BLOCKED')
  })
})

describe('STEP_STATE_CONFIG', () => {
  it('has config entries for all step states', () => {
    const states: StepState[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']
    for (const state of states) {
      expect(STEP_STATE_CONFIG[state]).toBeDefined()
      expect(STEP_STATE_CONFIG[state].label).toBeTruthy()
      expect(STEP_STATE_CONFIG[state].colorClass).toBeTruthy()
    }
  })

  it('has correct labels', () => {
    expect(STEP_STATE_CONFIG.NOT_STARTED.label).toBe('Not Started')
    expect(STEP_STATE_CONFIG.IN_PROGRESS.label).toBe('In Progress')
    expect(STEP_STATE_CONFIG.COMPLETED.label).toBe('Completed')
    expect(STEP_STATE_CONFIG.BLOCKED.label).toBe('Blocked')
  })
})
