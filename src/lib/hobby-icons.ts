import {
  Hammer, Paintbrush, Printer, Scissors, Cpu,
  Wrench, Palette, Flame, Ruler, Pencil,
  Layers, Cog,
  BookOpen, Utensils, CookingPot, Wine,
  Camera, Guitar, Bike, TreePine,
  Gem, Zap, Sword, CircuitBoard,
  Brush, Flower2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createElement } from 'react'

export const HOBBY_ICONS: Record<string, LucideIcon> = {
  // Workshop
  hammer: Hammer,
  wrench: Wrench,
  ruler: Ruler,
  cog: Cog,
  scissors: Scissors,
  printer: Printer,
  sword: Sword,
  // Creative
  paintbrush: Paintbrush,
  brush: Brush,
  palette: Palette,
  pencil: Pencil,
  layers: Layers,
  gem: Gem,
  camera: Camera,
  // Kitchen
  utensils: Utensils,
  'cooking-pot': CookingPot,
  wine: Wine,
  flame: Flame,
  // Tech
  cpu: Cpu,
  'circuit-board': CircuitBoard,
  zap: Zap,
  // Outdoors & Hobbies
  'book-open': BookOpen,
  guitar: Guitar,
  bike: Bike,
  'tree-pine': TreePine,
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
