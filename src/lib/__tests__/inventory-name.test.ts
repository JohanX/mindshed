import { describe, it, expect } from 'vitest'
import { nextUniqueInventoryName } from '../inventory-name'

describe('nextUniqueInventoryName', () => {
  it('returns the base name unchanged when no siblings exist', () => {
    expect(nextUniqueInventoryName('Kaolin', [])).toBe('Kaolin')
  })

  it('returns the base name unchanged when siblings are unrelated', () => {
    expect(nextUniqueInventoryName('Kaolin', ['Silica'])).toBe('Kaolin')
  })

  it('suffixes (1) on the first collision', () => {
    expect(nextUniqueInventoryName('Kaolin', ['Kaolin'])).toBe('Kaolin (1)')
  })

  it('matches collisions case-insensitively and preserves the input casing', () => {
    expect(nextUniqueInventoryName('kaolin', ['Kaolin'])).toBe('kaolin (1)')
  })

  it('advances to (2) when (1) is taken', () => {
    expect(nextUniqueInventoryName('Kaolin', ['Kaolin', 'Kaolin (1)'])).toBe('Kaolin (2)')
  })

  it('gap-fills the base slot when only higher integers exist', () => {
    expect(nextUniqueInventoryName('Kaolin', ['Kaolin (2)'])).toBe('Kaolin')
  })

  it('gap-fills an inner slot when base and a higher integer are taken', () => {
    expect(nextUniqueInventoryName('Kaolin', ['Kaolin', 'Kaolin (2)'])).toBe('Kaolin (1)')
  })

  it('escapes regex metacharacters in the base name', () => {
    expect(nextUniqueInventoryName('Project (A)', ['Project (A)'])).toBe('Project (A) (1)')
  })

  it('handles base names with dots and other regex metacharacters', () => {
    expect(nextUniqueInventoryName('v1.0', ['v1.0'])).toBe('v1.0 (1)')
  })

  it('ignores malformed leading-zero suffixes', () => {
    expect(nextUniqueInventoryName('Kaolin', ['Kaolin (01)'])).toBe('Kaolin')
  })

  it('anchors the suffix match — "(1) v2" does not count as slot 1', () => {
    expect(nextUniqueInventoryName('Kaolin', ['Kaolin', 'Kaolin (1) v2'])).toBe('Kaolin (1)')
  })

  it('matches case-insensitively on the suffix pattern too', () => {
    expect(nextUniqueInventoryName('Kaolin', ['kaolin (1)'])).toBe('Kaolin')
  })
})
