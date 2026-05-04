import { describe, it, expect } from 'vitest'
import { computeProjectTotalHours } from '../project-hours'

// Minimal stand-in for Prisma.Decimal (just the .toNumber() the helper uses).
function decimal(value: number) {
  return { toNumber: () => value }
}

describe('computeProjectTotalHours (Story 30.5 / FR129)', () => {
  it('returns null when tracking is disabled (regardless of step values)', () => {
    expect(
      computeProjectTotalHours(
        [{ hoursLogged: decimal(2.5) }, { hoursLogged: decimal(3) }],
        /* hobbyTracksHours */ false,
      ),
    ).toBeNull()
  })

  it('returns 0 when tracking is enabled but no step has logged hours', () => {
    expect(computeProjectTotalHours([], true)).toBe(0)
    expect(computeProjectTotalHours([{ hoursLogged: null }, { hoursLogged: null }], true)).toBe(0)
  })

  it('sums Decimal values correctly', () => {
    expect(
      computeProjectTotalHours(
        [{ hoursLogged: decimal(2.5) }, { hoursLogged: decimal(3) }, { hoursLogged: decimal(0.5) }],
        true,
      ),
    ).toBe(6)
  })

  it('skips null steps and sums the rest', () => {
    expect(
      computeProjectTotalHours(
        [{ hoursLogged: decimal(2.5) }, { hoursLogged: null }, { hoursLogged: decimal(1) }],
        true,
      ),
    ).toBe(3.5)
  })

  it('accepts plain numbers (test fixtures bypass Decimal)', () => {
    expect(computeProjectTotalHours([{ hoursLogged: 1 }, { hoursLogged: 2.5 }], true)).toBe(3.5)
  })

  it('handles a mix of Decimal and number inputs', () => {
    expect(
      computeProjectTotalHours(
        [{ hoursLogged: decimal(2) }, { hoursLogged: 1.5 }, { hoursLogged: null }],
        true,
      ),
    ).toBe(3.5)
  })
})
