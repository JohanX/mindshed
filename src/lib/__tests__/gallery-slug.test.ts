import { describe, it, expect } from 'vitest'
import { generateSlug, ensureUniqueSlug } from '@/lib/gallery-slug'

describe('generateSlug', () => {
  it('converts spaces to hyphens and lowercases', () => {
    expect(generateSlug('Walnut Side Table')).toBe('walnut-side-table')
  })

  it('removes special characters', () => {
    expect(generateSlug("Kai's Leather Bag #2!")).toBe('kai-s-leather-bag-2')
  })

  it('collapses consecutive special chars into single hyphen', () => {
    expect(generateSlug('project --- test')).toBe('project-test')
  })

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('  --Hello World--  ')).toBe('hello-world')
  })

  it('handles unicode characters', () => {
    expect(generateSlug('Tête-à-tête project')).toBe('t-te-t-te-project')
  })

  it('returns "project" for empty string', () => {
    expect(generateSlug('')).toBe('project')
  })

  it('returns "project" for whitespace-only string', () => {
    expect(generateSlug('   ')).toBe('project')
  })

  it('returns "project" for special-chars-only string', () => {
    expect(generateSlug('!!!@@@')).toBe('project')
  })

  it('handles numbers correctly', () => {
    expect(generateSlug('Project 42')).toBe('project-42')
  })
})

describe('ensureUniqueSlug', () => {
  it('returns slug unchanged when no conflict', () => {
    expect(ensureUniqueSlug('walnut-table', [])).toBe('walnut-table')
  })

  it('returns slug unchanged when existing slugs do not conflict', () => {
    expect(ensureUniqueSlug('walnut-table', ['leather-bag', 'pottery-vase'])).toBe('walnut-table')
  })

  it('appends -2 on first conflict', () => {
    expect(ensureUniqueSlug('walnut-table', ['walnut-table'])).toBe('walnut-table-2')
  })

  it('increments counter on multiple conflicts', () => {
    expect(ensureUniqueSlug('walnut-table', ['walnut-table', 'walnut-table-2'])).toBe('walnut-table-3')
  })

  it('finds next available counter with gaps', () => {
    expect(ensureUniqueSlug('walnut-table', ['walnut-table', 'walnut-table-2', 'walnut-table-3'])).toBe('walnut-table-4')
  })
})
