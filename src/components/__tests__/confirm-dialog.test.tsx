import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '../confirm-dialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Delete Woodworking?',
    description: 'All projects will be removed.',
    onConfirm: vi.fn(),
  }

  it('renders title and description', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Delete Woodworking?')).toBeInTheDocument()
    expect(screen.getByText('All projects will be removed.')).toBeInTheDocument()
  })

  it('calls onConfirm when Delete button is clicked', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByText('Delete'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('renders custom confirm label', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Remove" />)
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('renders default loading label by stripping trailing e (Delete → Deleting...)', () => {
    render(<ConfirmDialog {...defaultProps} loading />)
    expect(screen.getByText('Deleting...')).toBeInTheDocument()
    expect(screen.queryByText('Deleteing...')).not.toBeInTheDocument()
  })

  it('default loading label handles Save → Saving... (also drops trailing e)', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Save" loading />)
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('default loading label keeps stem for verbs without trailing e (Cancel → Canceling...)', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Cancel" loading />)
    expect(screen.getByText('Canceling...')).toBeInTheDocument()
  })

  it('honours explicit loadingLabel over the default', () => {
    render(<ConfirmDialog {...defaultProps} loading loadingLabel="Working…" />)
    expect(screen.getByText('Working…')).toBeInTheDocument()
    expect(screen.queryByText('Deleting...')).not.toBeInTheDocument()
  })
})
