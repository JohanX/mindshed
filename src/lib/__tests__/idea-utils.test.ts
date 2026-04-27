import { describe, it, expect } from 'vitest'
import { formatReferenceUrl } from '../idea-utils'

describe('formatReferenceUrl', () => {
  it('returns host + pathname for short URLs (no truncation)', () => {
    expect(formatReferenceUrl('https://example.com/path')).toBe('example.com/path')
  })

  it('returns just host when pathname is /', () => {
    expect(formatReferenceUrl('https://example.com/')).toBe('example.com')
  })

  it('truncates long URLs with ellipsis at maxLen=32', () => {
    const url = 'https://example.com/very/long/path/to/some/article'
    const result = formatReferenceUrl(url)
    expect(result.length).toBeLessThanOrEqual(32)
    expect(result.endsWith('…')).toBe(true)
    expect(result.startsWith('example.com/')).toBe(true)
  })

  it('respects custom maxLen', () => {
    const result = formatReferenceUrl('https://example.com/path/x', 10)
    expect(result).toBe('example.c…')
    expect(result.length).toBe(10)
  })

  it('handles http (not just https)', () => {
    expect(formatReferenceUrl('http://example.com/x')).toBe('example.com/x')
  })

  it('strips query string from compact form', () => {
    expect(formatReferenceUrl('https://example.com/path?q=1&y=2')).toBe('example.com/path')
  })

  it('falls back to raw URL truncation when URL parse fails', () => {
    expect(formatReferenceUrl('not-a-url')).toBe('not-a-url')
  })

  it('truncates raw fallback when too long', () => {
    const garbage = 'a'.repeat(50)
    const result = formatReferenceUrl(garbage)
    expect(result.length).toBe(32)
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns empty string for empty input', () => {
    expect(formatReferenceUrl('')).toBe('')
  })
})
