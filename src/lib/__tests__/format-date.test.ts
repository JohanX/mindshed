import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from '../format-date'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function setNow(date: Date) {
    vi.useFakeTimers()
    vi.setSystemTime(date)
  }

  const now = new Date('2026-04-06T12:00:00Z')

  it('returns "just now" for less than 60 seconds ago', () => {
    setNow(now)
    const date = new Date(now.getTime() - 30_000)
    expect(formatRelativeTime(date)).toBe('just now')
  })

  it('returns minutes ago for less than 60 minutes', () => {
    setNow(now)
    const date = new Date(now.getTime() - 5 * 60_000)
    expect(formatRelativeTime(date)).toBe('5m ago')
  })

  it('returns hours ago for less than 24 hours', () => {
    setNow(now)
    const date = new Date(now.getTime() - 3 * 3600_000)
    expect(formatRelativeTime(date)).toBe('3h ago')
  })

  it('returns days ago for less than 30 days', () => {
    setNow(now)
    const date = new Date(now.getTime() - 7 * 86400_000)
    expect(formatRelativeTime(date)).toBe('7d ago')
  })

  it('returns locale date string for 30+ days ago', () => {
    setNow(now)
    const date = new Date(now.getTime() - 31 * 86400_000)
    expect(formatRelativeTime(date)).toBe(date.toLocaleDateString())
  })

  it('returns "just now" for 0 seconds ago', () => {
    setNow(now)
    expect(formatRelativeTime(new Date(now))).toBe('just now')
  })

  it('boundary: 59 seconds returns "just now"', () => {
    setNow(now)
    const date = new Date(now.getTime() - 59_000)
    expect(formatRelativeTime(date)).toBe('just now')
  })

  it('boundary: 60 seconds returns "1m ago"', () => {
    setNow(now)
    const date = new Date(now.getTime() - 60_000)
    expect(formatRelativeTime(date)).toBe('1m ago')
  })
})
