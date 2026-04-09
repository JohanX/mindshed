import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepThumbnailStrip } from '@/components/step/step-thumbnail-strip'

describe('StepThumbnailStrip', () => {
  it('renders nothing when images array is empty', () => {
    const { container } = render(<StepThumbnailStrip images={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders up to 4 thumbnails for 4 images', () => {
    const images = Array.from({ length: 4 }, (_, i) => ({
      id: `img-${i}`,
      displayUrl: `https://example.com/photo-${i}.jpg`,
    }))
    render(<StepThumbnailStrip images={images} />)
    const container = screen.getByLabelText(`Step has ${images.length} photos`)
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(4)
  })

  it('shows "+3" badge when 7 images provided', () => {
    const images = Array.from({ length: 7 }, (_, i) => ({
      id: `img-${i}`,
      displayUrl: `https://example.com/photo-${i}.jpg`,
    }))
    render(<StepThumbnailStrip images={images} />)
    const container = screen.getByLabelText(`Step has ${images.length} photos`)
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(4)
    expect(screen.getByText('+3')).toBeInTheDocument()
  })

  it('has correct aria-label with image count', () => {
    const images = [
      { id: 'img-1', displayUrl: 'https://example.com/1.jpg' },
      { id: 'img-2', displayUrl: 'https://example.com/2.jpg' },
    ]
    render(<StepThumbnailStrip images={images} />)
    expect(screen.getByLabelText('Step has 2 photos')).toBeInTheDocument()
  })

  it('respects custom maxVisible prop', () => {
    const images = Array.from({ length: 5 }, (_, i) => ({
      id: `img-${i}`,
      displayUrl: `https://example.com/photo-${i}.jpg`,
    }))
    render(<StepThumbnailStrip images={images} maxVisible={2} />)
    const container = screen.getByLabelText('Step has 5 photos')
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
    expect(screen.getByText('+3')).toBeInTheDocument()
  })
})
