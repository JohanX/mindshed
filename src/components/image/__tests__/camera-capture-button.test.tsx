import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CameraCaptureButton } from '@/components/image/camera-capture-button'

vi.mock('@/lib/upload-image', () => ({
  uploadImageToStorage: vi.fn().mockResolvedValue({ success: true, key: 'test-key' }),
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
}))

vi.mock('@/lib/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}))

describe('CameraCaptureButton', () => {
  it('renders button with "Take Photo" label', () => {
    render(<CameraCaptureButton stepId="s1" />)
    expect(screen.getByText('Take Photo')).toBeInTheDocument()
  })

  it('hidden input has capture="environment" attribute', () => {
    const { container } = render(<CameraCaptureButton stepId="s1" />)
    const input = container.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('capture', 'environment')
  })

  it('hidden input has correct accept attribute', () => {
    const { container } = render(<CameraCaptureButton stepId="s1" />)
    const input = container.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
  })

  it('clicking button triggers hidden input click', async () => {
    const user = userEvent.setup()
    const { container } = render(<CameraCaptureButton stepId="s1" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    await user.click(screen.getByText('Take Photo'))
    expect(clickSpy).toHaveBeenCalled()
  })
})
