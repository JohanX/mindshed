import { describe, it, expect, vi } from 'vitest'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { showSuccessToast, showErrorToast } from '../toast'
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
