import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ImageGallery, type GalleryImage } from '@/components/image/image-gallery'

// Mock motion/react to avoid AnimatePresence lifecycle in JSDOM.
// Strips Framer-only props (layoutId / layout / transition) and
// forwards everything else to a plain DOM element of the same tag.
vi.mock('motion/react', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = String(key)
        const Component = (props: Record<string, unknown>) => {
          const { children, ...rest } = props as { children?: React.ReactNode }
          delete (rest as { layoutId?: unknown }).layoutId
          delete (rest as { layout?: unknown }).layout
          delete (rest as { transition?: unknown }).transition
          return React.createElement(tag, rest, children)
        }
        return Component
      },
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}))

vi.mock('@/components/image/image-delete-button', () => ({
  ImageDeleteButton: () => <button type="button">Delete</button>,
}))

vi.mock('@/lib/motion/motion-tokens', () => ({
  useMotionTokens: () => ({ transitions: { layout: {} } }),
}))

// Story 35.3 / FR136 — gallery tile branching tests.
describe('ImageGallery tile branching (Story 35.3 / FR136)', () => {
  it('renders <motion.img> for IMAGE rows (existing behaviour preserved)', () => {
    const images: GalleryImage[] = [
      {
        id: 'img-1',
        displayUrl: 'https://cdn.example.com/img.jpg',
        thumbnailUrl: 'https://cdn.example.com/img-thumb.jpg',
        originalFilename: 'photo.jpg',
        mediaType: 'IMAGE',
        durationSeconds: null,
        posterUrl: null,
      },
    ]
    render(<ImageGallery images={images} stepId="step-1" />)
    // Empty alt isn't queryable via getByAltText; check via DOM lookup.
    const img = document.querySelector('img') as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toBe('https://cdn.example.com/img-thumb.jpg')
    // No play overlay on IMAGE tiles.
    expect(screen.queryByTestId('video-play-overlay')).toBeNull()
  })

  it('renders poster + play overlay for VIDEO rows with posterUrl (Cloudinary)', () => {
    const images: GalleryImage[] = [
      {
        id: 'vid-1',
        displayUrl: 'https://cdn.example.com/clip.mp4',
        originalFilename: 'clip.mp4',
        mediaType: 'VIDEO',
        durationSeconds: 30,
        posterUrl: 'https://cdn.example.com/clip-poster.jpg',
      },
    ]
    render(<ImageGallery images={images} stepId="step-1" />)
    const poster = screen.getByAltText('clip.mp4')
    expect(poster.getAttribute('src')).toBe('https://cdn.example.com/clip-poster.jpg')
    expect(screen.getByTestId('video-play-overlay')).toBeTruthy()
    // No <video> element at tile size.
    expect(screen.queryByTestId('lightbox-video')).toBeNull()
    expect(document.querySelector('video')).toBeNull()
  })

  it('renders generic play-icon card + play overlay for VIDEO rows with null posterUrl (S3)', () => {
    const images: GalleryImage[] = [
      {
        id: 'vid-2',
        displayUrl: 'https://r2.example.com/clip.mp4',
        originalFilename: 'clip.mp4',
        mediaType: 'VIDEO',
        durationSeconds: 30,
        posterUrl: null,
      },
    ]
    render(<ImageGallery images={images} stepId="step-1" />)
    // No poster image rendered (no src for clip.mp4 alt).
    expect(screen.queryByAltText('clip.mp4')).toBeNull()
    // Play overlay still present.
    expect(screen.getByTestId('video-play-overlay')).toBeTruthy()
  })

  it('handles mixed-media decks (1 IMAGE + 1 VIDEO)', () => {
    const images: GalleryImage[] = [
      {
        id: 'img-1',
        displayUrl: 'https://cdn.example.com/img.jpg',
        thumbnailUrl: 'https://cdn.example.com/img-thumb.jpg',
        originalFilename: 'photo.jpg',
        mediaType: 'IMAGE',
        durationSeconds: null,
        posterUrl: null,
      },
      {
        id: 'vid-1',
        displayUrl: 'https://cdn.example.com/clip.mp4',
        originalFilename: 'clip.mp4',
        mediaType: 'VIDEO',
        durationSeconds: 30,
        posterUrl: 'https://cdn.example.com/clip-poster.jpg',
      },
    ]
    render(<ImageGallery images={images} stepId="step-1" />)
    // Both tiles present; one play overlay (on the video tile only).
    const overlays = screen.queryAllByTestId('video-play-overlay')
    expect(overlays.length).toBe(1)
  })

  it('treats undefined mediaType as IMAGE (back-compat with idea/inventory callers)', () => {
    const images: GalleryImage[] = [
      {
        id: 'legacy-1',
        displayUrl: 'https://cdn.example.com/photo.jpg',
        thumbnailUrl: 'https://cdn.example.com/photo-thumb.jpg',
        originalFilename: 'photo.jpg',
        // mediaType, durationSeconds, posterUrl all omitted
      },
    ]
    render(<ImageGallery images={images} stepId="step-1" />)
    expect(screen.queryByTestId('video-play-overlay')).toBeNull()
  })
})
