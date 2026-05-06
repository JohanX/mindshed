import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: { 'data-testid': 'mock-sortable-attrs' },
    listeners: { onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => null } },
}))

// Story 34.3 / FR130 — handle moved INSIDE StepCard. The mock mirrors
// the real StepCard's contract: when `dragHandle` is passed, render a
// button with the production aria-label so the existing prop-pass-
// through assertions continue to work without coupling to internal
// markup. When omitted, no handle renders — same gate as the
// `!isProjectCompleted` check inside SortableStepCard.
vi.mock('@/components/step/step-card', () => ({
  StepCard: ({
    step,
    dragHandle,
  }: {
    step: { name: string }
    dragHandle?: {
      attributes: DraggableAttributes
      listeners: DraggableSyntheticListeners
    }
  }) => (
    <div data-testid="mock-step-card">
      {dragHandle && (
        <button aria-label="Drag to reorder" {...dragHandle.attributes} {...dragHandle.listeners}>
          handle
        </button>
      )}
      {step.name}
    </div>
  ),
}))

import { SortableStepCard } from '@/components/step/sortable-step-card'

const mockStep = {
  id: 'step-1',
  name: 'Test Step',
  state: 'NOT_STARTED' as const,
  previousState: null,
  sortOrder: 0,
  notes: [],
  images: [],
  blockers: [],
  hoursLogged: null,
}

describe('SortableStepCard', () => {
  // Story 34.3 / FR130 — the responsive layout renders TWO drag handles
  // when reordering is enabled: a sibling-column instance for `sm:` and
  // up (visible at desktop) and an inline-in-StepCard instance for the
  // mobile-only path (rendered by the mock when `dragHandle` is passed).
  // JSDOM has no viewport / media-query awareness so both render
  // simultaneously in the test tree; we assert on the count rather than
  // a single match.

  it('renders both desktop + mobile drag handles when the project is NOT completed', () => {
    render(
      <SortableStepCard
        step={mockStep}
        variant="other"
        isProjectCompleted={false}
        hobbyTracksHours={false}
      />,
    )
    expect(screen.getAllByLabelText('Drag to reorder')).toHaveLength(2)
  })

  it('omits BOTH drag handles when the project IS completed', () => {
    render(
      <SortableStepCard
        step={mockStep}
        variant="other"
        isProjectCompleted={true}
        hobbyTracksHours={false}
      />,
    )
    expect(screen.queryByLabelText('Drag to reorder')).not.toBeInTheDocument()
  })

  it('renders StepCard with the step name', () => {
    render(
      <SortableStepCard
        step={mockStep}
        variant="current"
        isProjectCompleted={false}
        hobbyTracksHours={false}
      />,
    )
    expect(screen.getByTestId('mock-step-card')).toHaveTextContent('Test Step')
  })
})
