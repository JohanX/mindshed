/** Tangled ball of strings — represents the creative chaos of hobbies. Uses currentColor. */

interface IconProps {
  className?: string
}

/**
 * Variant A: Tight spiral tangle with two loose ends.
 * Dense center, organic overlapping loops.
 */
export function TangleA({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14 10 C16 14, 20 16, 24 15" />
      <path d="M24 15 C30 12, 42 10, 48 16 C54 22, 52 32, 46 36 C40 40, 30 42, 24 38 C18 34, 16 26, 20 20 C24 14, 34 14, 40 20 C46 26, 44 36, 38 40 C32 44, 22 44, 18 38 C14 32, 16 22, 22 18" />
      <path d="M28 18 C34 16, 44 20, 44 28 C44 36, 36 40, 28 38 C20 36, 18 28, 22 22 C26 16, 36 18, 40 24" />
      <path d="M30 24 C36 22, 42 26, 40 32 C38 38, 30 38, 28 34 C26 30, 28 26, 32 24" />
      <path d="M32 28 C36 26, 38 30, 36 33 C34 36, 30 34, 30 31 C30 28, 33 27, 35 29" />
      <path d="M38 40 C42 44, 46 48, 50 52" />
    </svg>
  )
}

/**
 * Variant B: Looser, rounder ball with flowing curves.
 * More circular silhouette, softer feel.
 */
export function TangleB({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* Loose end top */}
      <path d="M18 8 C20 12, 22 16, 26 18" />
      {/* Outer loop */}
      <path d="M26 18 C14 20, 8 30, 12 40 C16 50, 30 54, 40 50 C50 46, 56 36, 52 26 C48 16, 38 12, 26 18" />
      {/* Mid loop offset */}
      <path d="M22 24 C18 32, 20 42, 30 46 C40 50, 50 42, 48 32 C46 22, 36 18, 28 22" />
      {/* Inner loop */}
      <path d="M26 30 C24 36, 28 42, 36 42 C44 42, 46 36, 42 30 C38 24, 30 24, 26 30" />
      {/* Center figure-8 */}
      <path d="M32 30 C28 32, 28 38, 34 38 C40 38, 40 32, 36 30 C32 28, 30 32, 34 34" />
      {/* Loose end bottom */}
      <path d="M40 50 C44 52, 48 56, 50 58" />
    </svg>
  )
}

/**
 * Variant C: Scribble ball — energetic, sketchy overlapping arcs.
 * Feels hand-drawn and spontaneous. No loose ends.
 */
export function TangleC({ className }: IconProps) {
  return (
    <svg viewBox="4 6 56 52" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* Scribble arcs — overlapping in different directions */}
      <path d="M22 18 C12 22, 8 34, 16 42 C24 50, 42 52, 50 44" />
      <path d="M50 44 C56 36, 54 22, 44 16 C34 10, 20 14, 16 24" />
      <path d="M16 24 C12 34, 18 46, 32 48 C46 50, 54 40, 50 28" />
      <path d="M50 28 C46 18, 34 14, 24 20 C14 26, 14 40, 24 44" />
      <path d="M24 44 C34 48, 46 42, 46 32 C46 22, 36 18, 28 22" />
      {/* Inner knot */}
      <path d="M28 22 C22 28, 24 38, 34 40 C44 42, 48 34, 42 26 C36 18, 26 22, 30 30 C34 38, 42 36, 40 28 C38 22, 32 24, 34 30" />
    </svg>
  )
}

/**
 * Variant D: Yarn ball — neat concentric-ish wraps with a few crossing strands.
 * More structured, like an actual ball of yarn.
 */
export function TangleD({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* Loose end top */}
      <path d="M16 10 C18 14, 22 16, 26 16" />
      {/* Outer wrap */}
      <path d="M26 16 C16 18, 10 26, 10 34 C10 44, 18 52, 32 52 C46 52, 54 44, 54 34 C54 24, 46 16, 36 14" />
      {/* Crossing strand 1 — top-left to bottom-right */}
      <path d="M20 20 C28 28, 36 38, 46 46" />
      {/* Crossing strand 2 — top-right to bottom-left */}
      <path d="M46 20 C38 28, 28 38, 20 46" />
      {/* Horizontal wrap arcs */}
      <path d="M14 28 C22 24, 40 24, 50 28" />
      <path d="M12 36 C22 32, 42 32, 52 36" />
      <path d="M14 42 C24 38, 40 38, 50 42" />
      {/* Loose end trailing out */}
      <path d="M36 14 C40 12, 46 10, 50 8" />
    </svg>
  )
}

/** Default export — change this to swap which variant the app uses */
export const BrainIcon = TangleC
