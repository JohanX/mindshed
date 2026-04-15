/**
 * Hobby color palette generation.
 *
 * Converts a hobby color (HSL or hex) into CSS custom property values for theming.
 * Colors in the DB are stored as HSL strings like "hsl(215, 40%, 50%)".
 */

export interface HobbyPalette {
  primary: string
  accent: string
  card: string
  border: string
}

function parseColor(color: string): { h: number; s: number; l: number } {
  // Try HSL format first: hsl(h, s%, l%)
  const hslMatch = color.match(/hsl\(\s*(\d+),\s*(\d+)%,\s*(\d+)%\s*\)/)
  if (hslMatch) {
    return {
      h: parseInt(hslMatch[1], 10),
      s: parseInt(hslMatch[2], 10) / 100,
      l: parseInt(hslMatch[3], 10) / 100,
    }
  }

  // Fallback: hex format
  const clean = color.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l }
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6
  } else {
    h = ((r - g) / d + 4) / 6
  }

  return { h: h * 360, s, l }
}

function hslString(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}

export function generateHobbyPalette(color: string): HobbyPalette {
  const { h, s } = parseColor(color)

  return {
    primary: color,
    accent: hslString(h, Math.min(s, 0.3), 0.94),
    card: hslString(h, Math.min(s, 0.15), 0.98),
    border: hslString(h, Math.min(s, 0.2), 0.90),
  }
}

function generateHobbyPaletteDark(color: string): HobbyPalette {
  const { h, s } = parseColor(color)

  return {
    primary: color,
    accent: hslString(h, Math.min(s, 0.20), 0.22),
    card: hslString(h, Math.min(s, 0.15), 0.15),
    border: hslString(h, Math.min(s, 0.15), 0.28),
  }
}

/** Convert a hobby color to a version with alpha transparency (for subtle tints). */
export function hobbyColorWithAlpha(color: string, alpha: number): string {
  const hslMatch = color.match(/hsl\(\s*(\d+),\s*(\d+)%,\s*(\d+)%\s*\)/)
  if (hslMatch) {
    return `hsla(${hslMatch[1]}, ${hslMatch[2]}%, ${hslMatch[3]}%, ${alpha})`
  }
  // Hex fallback: use rgba
  const clean = color.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Determine whether white or dark text provides better contrast on a hobby color background. */
export function getContrastTextColor(color: string): 'white' | 'black' {
  const { l } = parseColor(color)
  return l <= 0.55 ? 'white' : 'black'
}

/**
 * Generate CSS custom property records for both light and dark hobby palettes.
 * The hobby layout sets both sets of vars; .dark selector activates the right ones.
 */
export function generateHobbyStyleVars(color: string): Record<string, string> {
  const light = generateHobbyPalette(color)
  const dark = generateHobbyPaletteDark(color)
  return {
    '--hobby-primary': light.primary,
    '--hobby-accent': light.accent,
    '--hobby-card': light.card,
    '--hobby-border': light.border,
    '--hobby-accent-dark': dark.accent,
    '--hobby-card-dark': dark.card,
    '--hobby-border-dark': dark.border,
  }
}
