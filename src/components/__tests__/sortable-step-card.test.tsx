import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => null } },
}))

vi.mock('@/components/step/step-card', () => ({
  StepCard: ({ step }: { step: { name: string } }) => (
    <div data-testid="mock-step-card">{step.name}</div>
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
}

describe('SortableStepCard', () => {
  it('renders drag handle when project is not completed', () => {
    render(<SortableStepCard step={mockStep} variant="other" isProjectCompleted={false} />)
    expect(screen.getByLabelText('Drag to reorder')).toBeInTheDocument()
  })

  it('hides drag handle when project is completed', () => {
    render(<SortableStepCard step={mockStep} variant="other" isProjectCompleted={true} />)
    expect(screen.queryByLabelText('Drag to reorder')).not.toBeInTheDocument()
  })

  it('renders StepCard with correct props', () => {
    render(<SortableStepCard step={mockStep} variant="current" isProjectCompleted={false} />)
    expect(screen.getByTestId('mock-step-card')).toHaveTextContent('Test Step')
  })
})
