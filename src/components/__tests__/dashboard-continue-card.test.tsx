import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardContinueCard } from '../dashboard/dashboard-continue-card'
import type { RecentProject } from '@/lib/schemas/dashboard'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...rest} />
  ),
}))

// Mock image storage adapter
vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: () => ({
    getPublicUrl: (key: string) => `https://r2.example.com/bucket/${key}`,
  }),
}))

const baseProject: RecentProject = {
  id: 'proj-1',
  name: 'Walnut Side Table',
  lastActivityAt: new Date('2026-03-15'),
  hobbyId: 'hobby-1',
  hobby: {
    id: 'hobby-1',
    name: 'Woodworking',
    color: 'hsl(25, 45%, 40%)',
    icon: null,
  },
  currentStep: {
    id: 'step-1',
    name: 'Apply danish oil',
  },
  latestPhoto: {
    storageKey: 'images/photo-1.jpg',
    originalFilename: 'photo.jpg',
  },
}

describe('DashboardContinueCard', () => {
  describe('primary variant', () => {
    it('renders project name', () => {
      render(<DashboardContinueCard project={baseProject} variant="primary" />)
      expect(screen.getByText('Walnut Side Table')).toBeInTheDocument()
    })

    it('renders hobby badge', () => {
      render(<DashboardContinueCard project={baseProject} variant="primary" />)
      expect(screen.getByText('Woodworking')).toBeInTheDocument()
    })

    it('renders current step name', () => {
      render(<DashboardContinueCard project={baseProject} variant="primary" />)
      expect(screen.getByText('Apply danish oil')).toBeInTheDocument()
    })

    it('renders photo thumbnail when latestPhoto exists', () => {
      render(<DashboardContinueCard project={baseProject} variant="primary" />)
      const img = screen.getByAltText('Latest photo for Walnut Side Table')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://r2.example.com/bucket/images/photo-1.jpg')
    })

    it('does not render photo when latestPhoto is null', () => {
      const noPhoto = { ...baseProject, latestPhoto: null }
      render(<DashboardContinueCard project={noPhoto} variant="primary" />)
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('links to correct project URL', () => {
      const { container } = render(
        <DashboardContinueCard project={baseProject} variant="primary" />,
      )
      const link = container.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/hobbies/hobby-1/projects/proj-1')
    })

    it('renders without current step when null', () => {
      const noStep = { ...baseProject, currentStep: null }
      render(<DashboardContinueCard project={noStep} variant="primary" />)
      expect(screen.getByText('Walnut Side Table')).toBeInTheDocument()
      expect(screen.queryByText('Apply danish oil')).not.toBeInTheDocument()
    })

    it('has min 44px touch target', () => {
      const { container } = render(
        <DashboardContinueCard project={baseProject} variant="primary" />,
      )
      const link = container.querySelector('a')
      expect(link?.className).toContain('min-h-[44px]')
    })
  })

  describe('secondary variant', () => {
    it('renders project name', () => {
      render(<DashboardContinueCard project={baseProject} variant="secondary" />)
      expect(screen.getByText('Walnut Side Table')).toBeInTheDocument()
    })

    it('renders current step name', () => {
      render(<DashboardContinueCard project={baseProject} variant="secondary" />)
      expect(screen.getByText('Apply danish oil')).toBeInTheDocument()
    })

    it('does not render photo in secondary variant', () => {
      render(<DashboardContinueCard project={baseProject} variant="secondary" />)
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('links to correct project URL', () => {
      const { container } = render(
        <DashboardContinueCard project={baseProject} variant="secondary" />,
      )
      const link = container.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/hobbies/hobby-1/projects/proj-1')
    })

    it('has min 44px touch target', () => {
      const { container } = render(
        <DashboardContinueCard project={baseProject} variant="secondary" />,
      )
      const link = container.querySelector('a')
      expect(link?.className).toContain('min-h-[44px]')
    })
  })
})
