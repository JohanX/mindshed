import { describe, it, expect } from 'vitest'
import { resolveHobbyIcon, renderHobbyIcon, HOBBY_ICONS, HOBBY_ICON_OPTIONS } from '../hobby-icons'

describe('resolveHobbyIcon', () => {
  it('returns correct icon component for valid name', () => {
    const icon = resolveHobbyIcon('hammer')
    expect(icon).toBe(HOBBY_ICONS.hammer)
  })

  it('returns null for null input', () => {
    expect(resolveHobbyIcon(null)).toBeNull()
  })

  it('returns null for unknown icon name', () => {
    expect(resolveHobbyIcon('nonexistent')).toBeNull()
  })

  it('has all icon options as keys in HOBBY_ICONS', () => {
    for (const name of HOBBY_ICON_OPTIONS) {
      expect(HOBBY_ICONS[name]).toBeDefined()
    }
  })
})

describe('renderHobbyIcon', () => {
  it('returns a React element for valid icon name', () => {
    const element = renderHobbyIcon('hammer', { className: 'h-5 w-5' })
    expect(element).not.toBeNull()
  })

  it('returns null for null input', () => {
    expect(renderHobbyIcon(null)).toBeNull()
  })

  it('returns null for unknown icon name', () => {
    expect(renderHobbyIcon('nonexistent')).toBeNull()
  })
})
