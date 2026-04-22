import { describe, it, expect } from 'vitest'
import {
  generateHobbyPalette,
  generateHobbyStyleVars,
  hobbyColorWithAlpha,
  getContrastTextColor,
} from '@/lib/hobby-color'

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
      // Rich band
      'hsl(25, 45%, 40%)', // Walnut
      'hsl(150, 40%, 35%)', // Forest
      'hsl(225, 45%, 38%)', // Navy
      'hsl(100, 25%, 40%)', // Moss
      'hsl(220, 25%, 45%)', // Storm
      'hsl(140, 25%, 45%)', // Sage
      'hsl(175, 35%, 45%)', // Teal
      // Vibrant band
      'hsl(15, 55%, 55%)', // Terracotta
      'hsl(25, 70%, 55%)', // Copper
      'hsl(215, 40%, 50%)', // Denim
      'hsl(280, 30%, 50%)', // Plum
      'hsl(45, 60%, 50%)', // Ochre
      'hsl(210, 15%, 50%)', // Slate
      // Fresh band
      'hsl(5, 50%, 60%)', // Coral
      'hsl(340, 45%, 60%)', // Rose
      'hsl(200, 55%, 65%)', // Sky
      'hsl(265, 40%, 65%)', // Lavender
      'hsl(160, 45%, 60%)', // Mint
      'hsl(20, 65%, 68%)', // Peach
      'hsl(48, 70%, 62%)', // Sunshine
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

describe('getContrastTextColor', () => {
  it('returns white for dark/mid hobby colors (lightness <= 55%)', () => {
    expect(getContrastTextColor('hsl(25, 45%, 40%)')).toBe('white') // Walnut
    expect(getContrastTextColor('hsl(140, 25%, 45%)')).toBe('white') // Sage
    expect(getContrastTextColor('hsl(175, 35%, 45%)')).toBe('white') // Teal
    expect(getContrastTextColor('hsl(100, 25%, 40%)')).toBe('white') // Moss
    expect(getContrastTextColor('hsl(220, 25%, 45%)')).toBe('white') // Storm
    expect(getContrastTextColor('hsl(215, 40%, 50%)')).toBe('white') // Denim
    expect(getContrastTextColor('hsl(210, 15%, 50%)')).toBe('white') // Slate
    expect(getContrastTextColor('hsl(280, 30%, 50%)')).toBe('white') // Plum
    expect(getContrastTextColor('hsl(45, 60%, 50%)')).toBe('white') // Ochre
    expect(getContrastTextColor('hsl(15, 55%, 55%)')).toBe('white') // Terracotta
    expect(getContrastTextColor('hsl(25, 70%, 55%)')).toBe('white') // Copper
  })

  it('returns black for light hobby colors (lightness > 55%)', () => {
    expect(getContrastTextColor('hsl(5, 50%, 60%)')).toBe('black') // Coral
    expect(getContrastTextColor('hsl(340, 45%, 60%)')).toBe('black') // Rose
    expect(getContrastTextColor('hsl(200, 55%, 65%)')).toBe('black') // Sky
    expect(getContrastTextColor('hsl(265, 40%, 65%)')).toBe('black') // Lavender
    expect(getContrastTextColor('hsl(160, 45%, 60%)')).toBe('black') // Mint
    expect(getContrastTextColor('hsl(20, 65%, 68%)')).toBe('black') // Peach
    expect(getContrastTextColor('hsl(48, 70%, 62%)')).toBe('black') // Sunshine
  })

  it('returns white for new dark hobby colors', () => {
    expect(getContrastTextColor('hsl(150, 40%, 35%)')).toBe('white') // Forest
    expect(getContrastTextColor('hsl(225, 45%, 38%)')).toBe('white') // Navy
  })

  it('returns white for hex black', () => {
    expect(getContrastTextColor('#000000')).toBe('white')
  })

  it('returns black for hex white', () => {
    expect(getContrastTextColor('#FFFFFF')).toBe('black')
  })
})

describe('generateHobbyStyleVars', () => {
  it('returns CSS custom property keys for light and dark palettes', () => {
    const vars = generateHobbyStyleVars('hsl(215, 40%, 50%)')
    expect(vars).toHaveProperty('--hobby-primary')
    expect(vars).toHaveProperty('--hobby-accent')
    expect(vars).toHaveProperty('--hobby-card')
    expect(vars).toHaveProperty('--hobby-border')
    expect(vars).toHaveProperty('--hobby-accent-dark')
    expect(vars).toHaveProperty('--hobby-card-dark')
    expect(vars).toHaveProperty('--hobby-border-dark')
  })

  it('maps palette values to CSS vars', () => {
    const vars = generateHobbyStyleVars('hsl(215, 40%, 50%)')
    expect(vars['--hobby-primary']).toBe('hsl(215, 40%, 50%)')
    expect(vars['--hobby-accent']).toMatch(/^hsl\(215,/)
    expect(vars['--hobby-card']).toMatch(/^hsl\(215,/)
    expect(vars['--hobby-border']).toMatch(/^hsl\(215,/)
  })

  it('generates dark palette variants with lower lightness', () => {
    const vars = generateHobbyStyleVars('hsl(215, 40%, 50%)')
    expect(vars['--hobby-accent-dark']).toMatch(/^hsl\(215, \d+%, 22%\)$/)
    expect(vars['--hobby-card-dark']).toMatch(/^hsl\(215, \d+%, 15%\)$/)
    expect(vars['--hobby-border-dark']).toMatch(/^hsl\(215, \d+%, 28%\)$/)
  })

  it('returns exactly 7 properties (light + dark)', () => {
    const vars = generateHobbyStyleVars('hsl(140, 25%, 45%)')
    expect(Object.keys(vars)).toHaveLength(7)
  })
})
