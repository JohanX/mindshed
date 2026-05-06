'use client'

import { GripVertical } from 'lucide-react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

/**
 * Story 34.3 / FR130 — shared drag-handle button used inline INSIDE
 * sortable card surfaces (step cards, hobby cards). Replaces the
 * sibling-of-card 52 px column that Story 32.1 introduced; the new
 * placement is flush with the card's leftmost edge so card content
 * reclaims the horizontal space on small viewports.
 *
 * Visible icon size: 20 px (h-5 w-5). Hit area: 44 × 44 px (CLAUDE.md
 * § "Touch targets") via min-h/min-w on the surrounding button —
 * transparent padding extends the tappable zone into the card's left
 * gutter without growing the visible icon.
 *
 * Touch posture (Story 32.1 contract preserved):
 *   - `touch-action: none` hands the gesture to dnd-kit's TouchSensor
 *     without iOS Safari fighting it with bouncy scroll.
 *   - `user-select: none` kills long-press text selection on the
 *     handle itself; surrounding card content keeps default text
 *     selection.
 */
interface DragHandleProps {
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
  /**
   * Optional extra className — e.g., a negative margin to pull the
   * icon visually flush with the card's outer edge when the parent
   * card has its own left padding.
   */
  className?: string
  /**
   * Optional onClick — useful when the handle is positioned over a
   * larger interactive surface (e.g., a hobby card wrapped in a
   * `<Link>`) and a stray tap should not navigate.
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export function DragHandle({ attributes, listeners, className, onClick }: DragHandleProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex shrink-0 items-center justify-center min-h-[44px] min-w-[44px]',
        'text-muted-foreground hover:text-foreground',
        'cursor-grab active:cursor-grabbing touch-none select-none',
        className,
      )}
      aria-label="Drag to reorder"
      onClick={onClick}
      {...attributes}
      {...(listeners ?? {})}
    >
      <GripVertical className="h-5 w-5" />
    </button>
  )
}
