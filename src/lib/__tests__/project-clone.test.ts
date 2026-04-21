import { describe, it, expect } from 'vitest'
import { nextCloneName } from '../project-clone'

describe('nextCloneName', () => {
  it('returns "{name} (copy)" when no copies exist', () => {
    expect(nextCloneName('Knife', [])).toBe('Knife (copy)')
  })

  it('returns "{name} (copy)" when unrelated names exist', () => {
    expect(nextCloneName('Knife', ['Sword', 'Axe'])).toBe('Knife (copy)')
  })

  it('returns "{name} (copy 2)" when (copy) is taken', () => {
    expect(nextCloneName('Knife', ['Knife (copy)'])).toBe('Knife (copy 2)')
  })

  it('returns "{name} (copy 3)" when (copy) and (copy 2) are taken', () => {
    expect(nextCloneName('Knife', ['Knife (copy)', 'Knife (copy 2)'])).toBe('Knife (copy 3)')
  })

  it('fills the (copy) slot when only higher integers exist', () => {
    expect(nextCloneName('Knife', ['Knife (copy 2)'])).toBe('Knife (copy)')
  })

  it('ignores names that share a prefix but are not exact copy suffixes', () => {
    expect(nextCloneName('Knife', ['Knife (copy) v2'])).toBe('Knife (copy)')
  })

  it('ignores the source name itself', () => {
    expect(nextCloneName('Knife', ['Knife'])).toBe('Knife (copy)')
  })

  it('escapes regex special characters in the base name', () => {
    expect(nextCloneName('Project (A)', ['Project (A) (copy)'])).toBe('Project (A) (copy 2)')
  })

  it('handles base names with dots and other regex metacharacters', () => {
    expect(nextCloneName('v1.0', ['v1.0 (copy)'])).toBe('v1.0 (copy 2)')
  })

  it('treats "(copy 1)" as a non-match — legal slot is always "(copy)" for n=1', () => {
    // "(copy 1)" is not a name we ever produce, so it should be ignored
    expect(nextCloneName('Knife', ['Knife (copy 1)'])).toBe('Knife (copy)')
  })
})
