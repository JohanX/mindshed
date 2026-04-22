import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepStatusSelect } from '@/components/step/step-status-select'

describe('StepStatusSelect', () => {
  it('renders with current state badge', () => {
    render(
      <StepStatusSelect currentState="IN_PROGRESS" previousState={null} onStateChange={vi.fn()} />,
    )
    expect(screen.getByLabelText('Step status')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('renders as disabled when disabled prop is true', () => {
    render(
      <StepStatusSelect
        currentState="NOT_STARTED"
        previousState={null}
        onStateChange={vi.fn()}
        disabled
      />,
    )
    expect(screen.getByLabelText('Step status')).toBeDisabled()
  })

  it('displays correct state for each step state', () => {
    const states = [
      { state: 'NOT_STARTED' as const, label: 'Not Started' },
      { state: 'IN_PROGRESS' as const, label: 'In Progress' },
      { state: 'COMPLETED' as const, label: 'Completed' },
      { state: 'BLOCKED' as const, label: 'Blocked' },
    ]

    for (const { state, label } of states) {
      const { unmount } = render(
        <StepStatusSelect currentState={state} previousState={null} onStateChange={vi.fn()} />,
      )
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })
})
