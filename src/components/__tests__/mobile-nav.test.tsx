import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileNav } from '../layout/mobile-nav'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

const mockHobbies = [
  { id: '1', name: 'Woodworking', color: 'hsl(25, 45%, 40%)', icon: 'hammer', sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), projectCount: 0, activeCount: 0, blockedCount: 0, idleCount: 0 },
]

describe('MobileNav — default state', () => {
  it('renders 4 navigation items', () => {
    render(<MobileNav hobbies={[]} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Hobbies')).toBeInTheDocument()
    expect(screen.getByText('Ideas')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('highlights active item for dashboard route', () => {
    render(<MobileNav hobbies={[]} />)
    const link = screen.getByText('Dashboard').closest('a')
    expect(link?.className).toContain('text-primary')
  })
})

describe('MobileNav — hobby context', () => {
  it('renders contextual navigation when inside a hobby', async () => {
    const { usePathname } = await import('next/navigation')
    vi.mocked(usePathname).mockReturnValue('/hobbies/1')
    render(<MobileNav hobbies={mockHobbies} />)
    expect(screen.getByText('← Hobbies')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Ideas')).toBeInTheDocument()
    vi.mocked(usePathname).mockReturnValue('/')
  })
})
