import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardContinueCard } from '../dashboard/dashboard-continue-card'
import type { RecentProject } from '@/lib/schemas/dashboard'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// Mock image storage adapter so resolveProjectThumbnailUrl returns a known URL.
vi.mock('@/lib/image-storage/adapter', () => ({
  getImageStorageAdapter: () => ({
    getPublicUrl: (key: string) => `https://r2.example.com/bucket/${key}`,
    getThumbnailUrl: (key: string, width: number) =>
      `https://r2.example.com/bucket/${key}?w=${width}`,
  }),
  isImageProviderSelfOptimized: () => true,
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
  totalSteps: 5,
  completedSteps: 2,
  derivedStatus: 'IN_PROGRESS',
  totalHoursLogged: null,
}

describe('DashboardContinueCard', () => {
  it('renders project name', () => {
    render(<DashboardContinueCard project={baseProject} />)
    expect(screen.getByText('Walnut Side Table')).toBeInTheDocument()
  })

  it('renders hobby badge', () => {
    render(<DashboardContinueCard project={baseProject} />)
    expect(screen.getByText('Woodworking')).toBeInTheDocument()
  })

  it('renders current step name', () => {
    render(<DashboardContinueCard project={baseProject} />)
    expect(screen.getByText('Apply danish oil')).toBeInTheDocument()
  })

  it('renders photo thumbnail when latestPhoto exists', () => {
    render(<DashboardContinueCard project={baseProject} />)
    const img = screen.getByAltText('Latest photo for Walnut Side Table')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://r2.example.com/bucket/images/photo-1.jpg?w=128')
  })

  it('does not render photo when latestPhoto is null', () => {
    const noPhoto = { ...baseProject, latestPhoto: null }
    render(<DashboardContinueCard project={noPhoto} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('links to correct project URL', () => {
    const { container } = render(<DashboardContinueCard project={baseProject} />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/hobbies/hobby-1/projects/proj-1')
  })

  it('renders without current step when null', () => {
    const noStep = { ...baseProject, currentStep: null }
    render(<DashboardContinueCard project={noStep} />)
    expect(screen.getByText('Walnut Side Table')).toBeInTheDocument()
    expect(screen.queryByText('Apply danish oil')).not.toBeInTheDocument()
  })

  it('has min 44px touch target', () => {
    const { container } = render(<DashboardContinueCard project={baseProject} />)
    const link = container.querySelector('a')
    expect(link?.className).toContain('min-h-[44px]')
  })
})
