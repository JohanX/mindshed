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

  describe('Story 29.3 / FR123 acknowledge primitive', () => {
    it('does NOT play the acknowledge animation on initial mount', () => {
      // First render is the natural mount, not a transition. The badge
      // should appear without the `anim-acknowledge-on-mount` class so
      // the user doesn't see a phantom pulse when the page loads.
      render(<StepStateBadge state={STEP_STATES.IN_PROGRESS} />)
      const badge = screen.getByText('In Progress')
      expect(badge.className).not.toContain('anim-acknowledge-on-mount')
    })

    it('plays the acknowledge animation when the state prop transitions', () => {
      // Re-render with a different state simulates an external state
      // change (e.g. user moves a step from IN_PROGRESS → COMPLETED).
      // The badge bumps a `key` to force remount + re-runs the animation.
      const { rerender } = render(<StepStateBadge state={STEP_STATES.IN_PROGRESS} />)
      rerender(<StepStateBadge state={STEP_STATES.COMPLETED} />)
      const badge = screen.getByText('Completed')
      expect(badge.className).toContain('anim-acknowledge-on-mount')
    })

    it('plays the animation on every subsequent transition, not just the first', () => {
      const { rerender } = render(<StepStateBadge state={STEP_STATES.NOT_STARTED} />)
      rerender(<StepStateBadge state={STEP_STATES.IN_PROGRESS} />)
      // Repeated transition — the key bump pattern means we always
      // remount and replay, not just the first transition.
      rerender(<StepStateBadge state={STEP_STATES.BLOCKED} />)
      const badge = screen.getByText('Blocked')
      expect(badge.className).toContain('anim-acknowledge-on-mount')
    })

    it('does NOT replay the animation when re-rendering with the same state', () => {
      // No state transition → no key bump → no animation. The badge
      // would otherwise pulse on every parent re-render, which is noise.
      const { rerender } = render(<StepStateBadge state={STEP_STATES.IN_PROGRESS} />)
      rerender(<StepStateBadge state={STEP_STATES.IN_PROGRESS} />)
      const badge = screen.getByText('In Progress')
      expect(badge.className).not.toContain('anim-acknowledge-on-mount')
    })
  })
})
