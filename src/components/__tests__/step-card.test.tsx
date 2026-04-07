import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepCard } from '../step/step-card'

vi.mock('@/actions/step', () => ({
  updateStepState: vi.fn().mockResolvedValue({ success: true, data: null }),
}))

vi.mock('@/lib/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}))

// Mock child components to isolate StepCard behavior
vi.mock('@/components/note/inline-note-input', () => ({
  InlineNoteInput: ({ stepId }: { stepId: string }) => <div data-testid={`mock-note-input-${stepId}`}>Note Input</div>,
}))
vi.mock('@/components/note/notes-list', () => ({
  NotesList: () => <div data-testid="mock-notes-list">Notes List</div>,
}))
vi.mock('@/components/image/image-gallery', () => ({
  ImageGallery: () => <div data-testid="mock-image-gallery">Gallery</div>,
}))
vi.mock('@/components/image/image-upload-button', () => ({
  ImageUploadButton: () => <div data-testid="mock-upload-btn">Upload</div>,
}))
vi.mock('@/components/image/image-link-input', () => ({
  ImageLinkInput: () => <div data-testid="mock-link-input">Link</div>,
}))
vi.mock('@/components/blocker/inline-blocker-input', () => ({
  InlineBlockerInput: () => <div data-testid="mock-blocker-input">Blocker Input</div>,
}))
vi.mock('@/components/blocker/blocker-card', () => ({
  BlockerCard: ({ description }: { id: string; description: string }) => <div data-testid="mock-blocker-card">{description}</div>,
}))

const baseStep = {
  id: 'step-1',
  name: 'Design the layout',
  state: 'NOT_STARTED' as const,
  sortOrder: 0,
  notes: [],
  images: [],
  blockers: [],
}

const defaultProps = {
  step: baseStep,
  variant: 'current' as const,
  isProjectCompleted: false,
}

describe('StepCard', () => {
  it('current variant renders expanded with section headers', () => {
    render(<StepCard {...defaultProps} variant="current" />)

    const header = screen.getByRole('button', { name: /Design the layout/i })
    expect(header).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByText('Photos')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
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

  it('no mutation actions when isProjectCompleted', () => {
    render(<StepCard {...defaultProps} isProjectCompleted={true} />)

    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-note-input-step-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-upload-btn')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-blocker-input')).not.toBeInTheDocument()
  })

  it('"Start" visible for NOT_STARTED state', () => {
    render(<StepCard {...defaultProps} step={{ ...baseStep, state: 'NOT_STARTED' }} />)
    expect(screen.getByTitle('Start step')).toBeInTheDocument()
  })

  it('"Mark Complete" visible for IN_PROGRESS state', () => {
    render(<StepCard {...defaultProps} step={{ ...baseStep, state: 'IN_PROGRESS' }} />)
    expect(screen.getByTitle('Mark complete')).toBeInTheDocument()
  })

  it('renders notes and images when provided', () => {
    render(
      <StepCard
        {...defaultProps}
        step={{
          ...baseStep,
          notes: [{ id: 'n1', text: 'My note', createdAt: new Date() }],
          images: [{ id: 'img1', displayUrl: 'https://example.com/photo.jpg', originalFilename: 'photo.jpg' }],
        }}
      />,
    )

    expect(screen.getByTestId('mock-notes-list')).toBeInTheDocument()
    expect(screen.getByTestId('mock-image-gallery')).toBeInTheDocument()
  })

  it('renders blocker cards when blockers exist', () => {
    render(
      <StepCard
        {...defaultProps}
        step={{
          ...baseStep,
          blockers: [{ id: 'b1', description: 'Waiting for glue to dry' }],
        }}
      />,
    )

    expect(screen.getByText('Waiting for glue to dry')).toBeInTheDocument()
  })
})
