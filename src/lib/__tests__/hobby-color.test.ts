import { describe, it, expect } from 'vitest'
import { generateHobbyPalette, generateHobbyStyleVars, hobbyColorWithAlpha } from '@/lib/hobby-color'

describe('generateHobbyPalette', () => {
  it('returns all four palette properties', () => {
    const palette = generateHobbyPalette('hsl(215, 40%, 50%)')
    expect(palette).toHaveProperty('primary')
    expect(palette).toHaveProperty('accent')
    expect(palette).toHaveProperty('card')
    expect(palette).toHaveProperty('border')
  })

  it('uses the original color as primary', () => {
    const palette = generateHobbyPalette('hsl(215, 40%, 50%)')
    expect(palette.primary).toBe('hsl(215, 40%, 50%)')
  })

  it('generates HSL strings for accent, card, border from HSL input', () => {
    const palette = generateHobbyPalette('hsl(15, 55%, 55%)')
    expect(palette.accent).toMatch(/^hsl\(\d+, \d+%, 94%\)$/)
    expect(palette.card).toMatch(/^hsl\(\d+, \d+%, 98%\)$/)
    expect(palette.border).toMatch(/^hsl\(\d+, \d+%, 90%\)$/)
  })

  it('preserves hue from HSL input', () => {
    const palette = generateHobbyPalette('hsl(215, 40%, 50%)')
    expect(palette.accent).toMatch(/^hsl\(215,/)
    expect(palette.card).toMatch(/^hsl\(215,/)
    expect(palette.border).toMatch(/^hsl\(215,/)
  })

  it('works with all curated hobby colors', () => {
    const curatedColors = [
      'hsl(15, 55%, 55%)',   // Terracotta
      'hsl(25, 45%, 40%)',   // Walnut
      'hsl(215, 40%, 50%)',  // Denim
      'hsl(140, 25%, 45%)',  // Sage
      'hsl(25, 70%, 55%)',   // Copper
      'hsl(210, 15%, 50%)',  // Slate
      'hsl(280, 30%, 50%)',  // Plum
      'hsl(175, 35%, 45%)',  // Teal
      'hsl(45, 60%, 50%)',   // Ochre
      'hsl(100, 25%, 40%)',  // Moss
      'hsl(5, 50%, 60%)',    // Coral
      'hsl(220, 25%, 45%)',  // Storm
    ]

    for (const color of curatedColors) {
      const palette = generateHobbyPalette(color)
      expect(palette.primary).toBe(color)
      expect(palette.accent).toMatch(/^hsl\(\d+, \d+%, 94%\)$/)
      expect(palette.card).toMatch(/^hsl\(\d+, \d+%, 98%\)$/)
      expect(palette.border).toMatch(/^hsl\(\d+, \d+%, 90%\)$/)
    }
  })

  it('caps saturation for accent at 30%', () => {
    const palette = generateHobbyPalette('hsl(25, 70%, 55%)')
    expect(palette.accent).toBe('hsl(25, 30%, 94%)')
  })

  it('caps saturation for card at 15%', () => {
    const palette = generateHobbyPalette('hsl(25, 70%, 55%)')
    expect(palette.card).toBe('hsl(25, 15%, 98%)')
  })

  it('caps saturation for border at 20%', () => {
    const palette = generateHobbyPalette('hsl(25, 70%, 55%)')
    expect(palette.border).toBe('hsl(25, 20%, 90%)')
  })

  it('handles hex color input as fallback', () => {
    const palette = generateHobbyPalette('#8B6F47')
    expect(palette.primary).toBe('#8B6F47')
    expect(palette.accent).toMatch(/^hsl\(/)
    expect(palette.card).toMatch(/^hsl\(/)
    expect(palette.border).toMatch(/^hsl\(/)
  })

  it('handles black hex (#000000)', () => {
    const palette = generateHobbyPalette('#000000')
    expect(palette.primary).toBe('#000000')
    expect(palette.accent).toMatch(/^hsl\(/)
  })

  it('handles white hex (#FFFFFF)', () => {
    const palette = generateHobbyPalette('#FFFFFF')
    expect(palette.primary).toBe('#FFFFFF')
    expect(palette.accent).toMatch(/^hsl\(/)
  })

  it('handles low saturation HSL', () => {
    const palette = generateHobbyPalette('hsl(210, 5%, 50%)')
    // Saturation should not be capped since it's already below thresholds
    expect(palette.accent).toBe('hsl(210, 5%, 94%)')
    expect(palette.card).toBe('hsl(210, 5%, 98%)')
    expect(palette.border).toBe('hsl(210, 5%, 90%)')
  })
})

describe('hobbyColorWithAlpha', () => {
  it('converts HSL to HSLA with alpha', () => {
    expect(hobbyColorWithAlpha('hsl(215, 40%, 50%)', 0.05)).toBe('hsla(215, 40%, 50%, 0.05)')
  })

  it('converts hex to RGBA with alpha', () => {
    expect(hobbyColorWithAlpha('#FF0000', 0.1)).toBe('rgba(255, 0, 0, 0.1)')
  })

  it('works with all curated colors', () => {
    const result = hobbyColorWithAlpha('hsl(15, 55%, 55%)', 0.05)
    expect(result).toBe('hsla(15, 55%, 55%, 0.05)')
  })
})

describe('generateHobbyStyleVars', () => {
  it('returns CSS custom property keys', () => {
    const vars = generateHobbyStyleVars('hsl(215, 40%, 50%)')
    expect(vars).toHaveProperty('--hobby-primary')
    expect(vars).toHaveProperty('--hobby-accent')
    expect(vars).toHaveProperty('--hobby-card')
    expect(vars).toHaveProperty('--hobby-border')
  })

  it('maps palette values to CSS vars', () => {
    const vars = generateHobbyStyleVars('hsl(215, 40%, 50%)')
    expect(vars['--hobby-primary']).toBe('hsl(215, 40%, 50%)')
    expect(vars['--hobby-accent']).toMatch(/^hsl\(215,/)
    expect(vars['--hobby-card']).toMatch(/^hsl\(215,/)
    expect(vars['--hobby-border']).toMatch(/^hsl\(215,/)
  })

  it('returns exactly 4 properties', () => {
    const vars = generateHobbyStyleVars('hsl(140, 25%, 45%)')
    expect(Object.keys(vars)).toHaveLength(4)
  })
})
