import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

vi.mock('@/actions/blocker', () => ({
  resolveBlocker: vi.fn(),
  updateBlocker: vi.fn(),
  deleteBlocker: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}))

import { BlockerCard } from '../blocker-card'
import { resolveBlocker } from '@/actions/blocker'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

const mockResolve = vi.mocked(resolveBlocker)
const mockSuccess = vi.mocked(showSuccessToast)
const mockError = vi.mocked(showErrorToast)

function setMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('BlockerCard — Story 29.3 retroactive: held-resolved feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMatchMedia(false) // default: motion enabled
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the normal UI on initial mount, with no acknowledge class', () => {
    render(<BlockerCard id="b1" description="Need clay" />)
    expect(screen.getByText('Need clay')).toBeInTheDocument()
    expect(screen.queryByTestId('blocker-card-resolved')).toBeNull()
  })

  it('switches to the held-resolved UI on Resolve click', () => {
    mockResolve.mockResolvedValue({
      success: true,
      data: { id: 'b1', description: 'Need clay', isResolved: true },
    })
    render(<BlockerCard id="b1" description="Need clay" />)

    fireEvent.click(screen.getByRole('button', { name: /resolve blocker/i }))

    // The resolved UI is rendered immediately with the acknowledge class.
    const resolved = screen.getByTestId('blocker-card-resolved')
    expect(resolved).toBeInTheDocument()
    expect(resolved.className).toContain('anim-acknowledge-on-mount')
    expect(resolved.textContent).toContain('Resolved')
    // The original description is still visible (struck-through) so the
    // user sees what was resolved.
    expect(resolved.textContent).toContain('Need clay')
  })

  it('does NOT call resolveBlocker until the hold duration elapses', () => {
    mockResolve.mockResolvedValue({
      success: true,
      data: { id: 'b1', description: 'Need clay', isResolved: true },
    })
    render(<BlockerCard id="b1" description="Need clay" />)

    fireEvent.click(screen.getByRole('button', { name: /resolve blocker/i }))

    // Action has NOT fired yet — we're inside the hold window.
    expect(mockResolve).not.toHaveBeenCalled()

    // Advance past the hold; useTransition kicks off the action.
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(mockResolve).toHaveBeenCalledWith({ blockerId: 'b1' })
  })

  it('fires the success toast after a successful resolve', async () => {
    mockResolve.mockResolvedValue({
      success: true,
      data: { id: 'b1', description: 'Need clay', isResolved: true },
    })
    render(<BlockerCard id="b1" description="Need clay" />)

    fireEvent.click(screen.getByRole('button', { name: /resolve blocker/i }))
    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith('Blocker resolved'))
  })

  it('snaps back to the normal UI on action failure and fires an error toast', async () => {
    mockResolve.mockResolvedValue({ success: false, error: 'Server down' })
    render(<BlockerCard id="b1" description="Need clay" />)

    fireEvent.click(screen.getByRole('button', { name: /resolve blocker/i }))
    expect(screen.getByTestId('blocker-card-resolved')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    await waitFor(() => expect(mockError).toHaveBeenCalledWith('Server down'))
    // Resolved view is gone; user can retry from the normal UI.
    await waitFor(() => expect(screen.queryByTestId('blocker-card-resolved')).toBeNull())
  })

  it('debounces double-clicks — second click does not re-fire the action', () => {
    mockResolve.mockResolvedValue({
      success: true,
      data: { id: 'b1', description: 'Need clay', isResolved: true },
    })
    render(<BlockerCard id="b1" description="Need clay" />)

    const button = screen.getByRole('button', { name: /resolve blocker/i })
    // First click flips to resolved view + schedules the timer; the
    // button leaves the DOM (replaced by the resolved view's UI). A
    // second click on a stale reference is a no-op (button unmounted).
    fireEvent.click(button)
    expect(screen.getByTestId('blocker-card-resolved')).toBeInTheDocument()
    expect(button.isConnected).toBe(false)
    expect(mockResolve).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(mockResolve).toHaveBeenCalledTimes(1)
  })

  describe('prefers-reduced-motion', () => {
    beforeEach(() => {
      setMatchMedia(true)
    })

    it('skips the held-resolved view and fires the action immediately', () => {
      mockResolve.mockResolvedValue({
        success: true,
        data: { id: 'b1', description: 'Need clay', isResolved: true },
      })
      render(<BlockerCard id="b1" description="Need clay" />)

      fireEvent.click(screen.getByRole('button', { name: /resolve blocker/i }))

      // No held UI; action fires synchronously inside the transition.
      expect(screen.queryByTestId('blocker-card-resolved')).toBeNull()
      expect(mockResolve).toHaveBeenCalledWith({ blockerId: 'b1' })
    })
  })
})
