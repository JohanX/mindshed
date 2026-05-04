import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  showSuccessToast,
  showErrorToast,
  deferredSuccessToast,
  TOAST_SUCCESS_DEFER_MS,
} from '../toast'
import { toast } from 'sonner'

describe('showSuccessToast', () => {
  it('calls toast.success with message and 3s duration', () => {
    showSuccessToast('Hobby created')
    expect(toast.success).toHaveBeenCalledWith('Hobby created', { duration: 3000 })
  })
})

describe('showErrorToast', () => {
  it('calls toast.error with message and 5s duration', () => {
    showErrorToast('Upload failed — try again')
    expect(toast.error).toHaveBeenCalledWith('Upload failed — try again', {
      duration: 5000,
      closeButton: true,
    })
  })
})

describe('deferredSuccessToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(toast.success).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not fire toast.success synchronously', () => {
    deferredSuccessToast('Hobby created')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('fires toast.success after TOAST_SUCCESS_DEFER_MS with the original message', () => {
    deferredSuccessToast('Hobby updated')
    expect(toast.success).not.toHaveBeenCalled()
    vi.advanceTimersByTime(TOAST_SUCCESS_DEFER_MS - 1)
    expect(toast.success).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Hobby updated', { duration: 3000 })
  })

  it('queues independently per call (two consecutive calls produce two toasts)', () => {
    deferredSuccessToast('Hobby created')
    deferredSuccessToast('Hobby updated')
    vi.advanceTimersByTime(TOAST_SUCCESS_DEFER_MS)
    expect(toast.success).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenNthCalledWith(1, 'Hobby created', { duration: 3000 })
    expect(toast.success).toHaveBeenNthCalledWith(2, 'Hobby updated', { duration: 3000 })
  })
})
