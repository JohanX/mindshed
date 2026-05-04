import { describe, it, expect } from 'vitest'
import { formatHours } from '../hours-format'

describe('formatHours (Story 30.5 / FR129)', () => {
  it('returns null for null', () => {
    expect(formatHours(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatHours(undefined)).toBeNull()
  })

  it('returns null for 0 (hide "0h" noise from cards)', () => {
    expect(formatHours(0)).toBeNull()
  })

  it('formats integers without a decimal', () => {
    expect(formatHours(1)).toBe('1h')
    expect(formatHours(6)).toBe('6h')
    expect(formatHours(100)).toBe('100h')
  })

  it('formats fractional values with one decimal', () => {
    expect(formatHours(0.5)).toBe('0.5h')
    expect(formatHours(2.5)).toBe('2.5h')
    expect(formatHours(6.5)).toBe('6.5h')
  })

  it('formats large fractional totals consistently', () => {
    expect(formatHours(99.5)).toBe('99.5h')
  })
})
