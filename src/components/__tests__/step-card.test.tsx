import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepCard } from '../step/step-card'

// Mock server action
vi.mock('@/actions/step', () => ({
  updateStepState: vi.fn().mockResolvedValue({ success: true, data: null }),
}))

// Mock toast
vi.mock('@/lib/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}))

const baseStep = {
  id: 'step-1',
  name: 'Design the layout',
  state: 'NOT_STARTED' as const,
  sortOrder: 0,
}

const defaultProps = {
  step: baseStep,
  variant: 'current' as const,
  isProjectCompleted: false,
  projectId: 'proj-1',
  hobbyId: 'hobby-1',
}

describe('StepCard', () => {
  it('current variant renders expanded with action buttons', () => {
    render(<StepCard {...defaultProps} variant="current" />)

    const header = screen.getByRole('button', { name: /Design the layout/i })
    expect(header).toHaveAttribute('aria-expanded', 'true')

    // Action buttons should be present
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload Photo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Blocker' })).toBeInTheDocument()
  })

  it('other variant renders collapsed', () => {
    render(<StepCard {...defaultProps} variant="other" />)

    const header = screen.getByRole('button', { name: /Design the layout/i })
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking header toggles expand/collapse', async () => {
    const user = userEvent.setup()
    render(<StepCard {...defaultProps} variant="other" />)

    const header = screen.getByRole('button', { name: /Design the layout/i })
    expect(header).toHaveAttribute('aria-expanded', 'false')

    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')

    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('no action buttons when isProjectCompleted', () => {
    render(<StepCard {...defaultProps} isProjectCompleted={true} />)

    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Note' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload Photo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Blocker' })).not.toBeInTheDocument()
  })

  it('"Start" visible for NOT_STARTED state', () => {
    render(
      <StepCard
        {...defaultProps}
        step={{ ...baseStep, state: 'NOT_STARTED' }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark Complete' })).not.toBeInTheDocument()
  })

  it('"Mark Complete" visible for IN_PROGRESS state', () => {
    render(
      <StepCard
        {...defaultProps}
        step={{ ...baseStep, state: 'IN_PROGRESS' }}
      />,
    )

    expect(screen.getByRole('button', { name: 'Mark Complete' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
  })

  it('shows step name and state badge', () => {
    render(<StepCard {...defaultProps} />)

    expect(screen.getByText('Design the layout')).toBeInTheDocument()
    expect(screen.getByText('Not Started')).toBeInTheDocument()
  })
})
