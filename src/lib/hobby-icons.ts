import {
  Hammer,
  Paintbrush,
  Scissors,
  Cpu,
  Wrench,
  Palette,
  Pencil,
  Code,
  Cog,
  BookOpen,
  Utensils,
  CookingPot,
  Camera,
  Guitar,
  Bike,
  Gem,
  Sword,
  PocketKnife,
  Flower2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createElement } from 'react'

// 19 lucide icons + the explicit "None" button in the picker = 20 total
// buttons, which fills the 5-col mobile grid cleanly (4 rows × 5 cols)
// after the Story 31.4 follow-up reduced the picker columns. Curated
// for one icon per distinct hobby family: workshop tools, creative,
// kitchen, tech, lifestyle. Removed redundancies: Brush ≈ Paintbrush,
// CircuitBoard ≈ Cpu, TreePine ≈ Flower2 (both nature). Removed niche
// icons that didn't map to a clear hobby: Printer, Wine, Flame, Zap,
// Layers, Ruler. Sword is kept alongside PocketKnife — ornamental long
// blade vs utility folding knife are distinct aesthetic options.
export const HOBBY_ICONS: Record<string, LucideIcon> = {
  // Workshop
  hammer: Hammer,
  wrench: Wrench,
  cog: Cog,
  scissors: Scissors,
  sword: Sword,
  'pocket-knife': PocketKnife,
  // Creative
  paintbrush: Paintbrush,
  palette: Palette,
  pencil: Pencil,
  gem: Gem,
  camera: Camera,
  // Kitchen
  utensils: Utensils,
  'cooking-pot': CookingPot,
  // Tech
  cpu: Cpu,
  code: Code,
  // Lifestyle
  'book-open': BookOpen,
  guitar: Guitar,
  bike: Bike,
  flower: Flower2,
}

export const HOBBY_ICON_OPTIONS = Object.keys(HOBBY_ICONS)

export function resolveHobbyIcon(iconName: string | null): LucideIcon | null {
  if (!iconName) return null
  return HOBBY_ICONS[iconName] ?? null
}

export function renderHobbyIcon(
  iconName: string | null,
  props: { className?: string; style?: React.CSSProperties } = {},
): React.ReactElement | null {
  const Icon = resolveHobbyIcon(iconName)
  if (!Icon) return null
  return createElement(Icon, props)
}
