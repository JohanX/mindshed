import {
  Hammer, Paintbrush, Printer, Scissors, Cpu,
  Wrench, Palette, Flame, Ruler, Pencil,
  Layers, Cog,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createElement } from 'react'

export const HOBBY_ICONS: Record<string, LucideIcon> = {
  hammer: Hammer,
  paintbrush: Paintbrush,
  printer: Printer,
  scissors: Scissors,
  cpu: Cpu,
  wrench: Wrench,
  palette: Palette,
  flame: Flame,
  ruler: Ruler,
  pencil: Pencil,
  layers: Layers,
  cog: Cog,
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
