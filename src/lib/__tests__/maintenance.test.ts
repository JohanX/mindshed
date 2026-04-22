import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getNextMaintenanceDate, isMaintenanceOverdue, getDaysOverdue } from '../maintenance'

// IMPORTANT: maintenance.ts uses `setDate(getDate() + n)` — LOCAL time
// semantics. Inputs below use local-time constructors so assertions are
// stable across CI timezones (UTC-constructed dates + local setDate can
// cross day boundaries under DST / non-UTC offsets).
describe('getNextMaintenanceDate', () => {
  it('adds interval days to the last maintenance date', () => {
    const last = new Date(2026, 0, 1) // Jan 1 local time
    const next = getNextMaintenanceDate(last, 30)
    expect(next.getDate()).toBe(31)
    expect(next.getMonth()).toBe(0)
  })

  it('rolls over month boundary', () => {
    const last = new Date(2026, 0, 25)
    const next = getNextMaintenanceDate(last, 10)
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(4)
  })

  it('rolls over year boundary', () => {
    const last = new Date(2025, 11, 20) // Dec 20
    const next = getNextMaintenanceDate(last, 20)
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(0)
    expect(next.getDate()).toBe(9)
  })

  it('handles leap year Feb 29 correctly', () => {
    const last = new Date(2024, 1, 28) // Feb 28, 2024 (leap)
    const next = getNextMaintenanceDate(last, 1)
    expect(next.getMonth()).toBe(1)
    expect(next.getDate()).toBe(29)
  })

  it('does not mutate the input date', () => {
    const last = new Date(2026, 0, 1)
    const snapshot = last.getTime()
    getNextMaintenanceDate(last, 30)
    expect(last.getTime()).toBe(snapshot)
  })

  it('handles 0 interval (due immediately)', () => {
    const last = new Date(2026, 5, 15, 10, 0, 0)
    const next = getNextMaintenanceDate(last, 0)
    expect(next.getTime()).toBe(last.getTime())
  })

  it('handles negative interval (backward)', () => {
    const last = new Date(2026, 5, 15)
    const next = getNextMaintenanceDate(last, -5)
    expect(next.getDate()).toBe(10)
  })
})

describe('isMaintenanceOverdue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns false when next date is in the future', () => {
    vi.setSystemTime(new Date(2026, 3, 1)) // Apr 1 local
    const last = new Date(2026, 2, 20) // Mar 20 local
    expect(isMaintenanceOverdue(last, 30)).toBe(false)
  })

  it('returns true when next date has passed', () => {
    vi.setSystemTime(new Date(2026, 4, 1)) // May 1 local
    const last = new Date(2026, 2, 1) // Mar 1 local
    expect(isMaintenanceOverdue(last, 30)).toBe(true)
  })

  it('returns false exactly at the due moment (strict less-than)', () => {
    // last + 30d === now → next < now is false → not overdue
    const last = new Date(2026, 3, 1) // Apr 1 local
    vi.setSystemTime(new Date(2026, 4, 1)) // May 1 local (exactly 30d later)
    expect(isMaintenanceOverdue(last, 30)).toBe(false)
  })

  it('returns true 1 second past due', () => {
    const last = new Date(2026, 3, 1, 0, 0, 0)
    vi.setSystemTime(new Date(2026, 4, 1, 0, 0, 1))
    expect(isMaintenanceOverdue(last, 30)).toBe(true)
  })
})

describe('getDaysOverdue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns 0 when not yet due', () => {
    vi.setSystemTime(new Date(2026, 3, 1)) // Apr 1 local
    const last = new Date(2026, 2, 25) // Mar 25 local
    expect(getDaysOverdue(last, 30)).toBe(0)
  })

  it('returns 0 when exactly at due date', () => {
    const last = new Date(2026, 3, 1) // Apr 1 local
    vi.setSystemTime(new Date(2026, 4, 1)) // May 1 local (exactly 30d later)
    expect(getDaysOverdue(last, 30)).toBe(0)
  })

  it('returns positive integer days for overdue tools', () => {
    const last = new Date(2026, 2, 1) // Mar 1
    vi.setSystemTime(new Date(2026, 4, 1)) // May 1
    // next = Mar 31; now = May 1 → 31 days overdue
    expect(getDaysOverdue(last, 30)).toBe(31)
  })

  it('floors partial days', () => {
    const last = new Date(2026, 3, 1, 0, 0, 0) // Apr 1 00:00 local
    // next = May 1 00:00 local; now = May 3 12:00 local → 2.5d → floor to 2
    vi.setSystemTime(new Date(2026, 4, 3, 12, 0, 0))
    expect(getDaysOverdue(last, 30)).toBe(2)
  })
})
