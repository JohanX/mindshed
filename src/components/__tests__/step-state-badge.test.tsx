import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepStateBadge } from '../step-state-badge'
import { STEP_STATES } from '@/lib/step-states'

describe('StepStateBadge', () => {
  it('renders correct label for each state', () => {
    const { rerender } = render(<StepStateBadge state={STEP_STATES.NOT_STARTED} />)
    expect(screen.getByText('Not Started')).toBeInTheDocument()

    rerender(<StepStateBadge state={STEP_STATES.IN_PROGRESS} />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()

    rerender(<StepStateBadge state={STEP_STATES.COMPLETED} />)
    expect(screen.getByText('Completed')).toBeInTheDocument()

    rerender(<StepStateBadge state={STEP_STATES.BLOCKED} />)
    expect(screen.getByText('Blocked')).toBeInTheDocument()
  })

  it('renders default size with correct classes', () => {
    render(<StepStateBadge state={STEP_STATES.IN_PROGRESS} />)
    const badge = screen.getByText('In Progress')
    expect(badge.className).toContain('px-2')
    expect(badge.className).toContain('py-0.5')
  })

  it('renders sm size with correct classes', () => {
    render(<StepStateBadge state={STEP_STATES.COMPLETED} size="sm" />)
    const badge = screen.getByText('Completed')
    expect(badge.className).toContain('px-1.5')
  })

  it('applies state-specific color classes', () => {
    render(<StepStateBadge state={STEP_STATES.BLOCKED} />)
    const badge = screen.getByText('Blocked')
    expect(badge.className).toContain('bg-step-blocked')
  })
})
