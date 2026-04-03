import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NavSidebar } from '../layout/nav-sidebar'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

describe('NavSidebar', () => {
  it('renders all 3 navigation items with labels', () => {
    render(<NavSidebar />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Hobbies')).toBeInTheDocument()
    expect(screen.getByText('Ideas')).toBeInTheDocument()
  })

  it('renders MindShed branding', () => {
    render(<NavSidebar />)
    expect(screen.getByText('MindShed')).toBeInTheDocument()
  })

  it('highlights active item for dashboard', () => {
    render(<NavSidebar />)
    const dashboardLink = screen.getByText('Dashboard').closest('a')
    expect(dashboardLink?.className).toContain('bg-accent')
  })

  it('highlights active item for hobbies route', async () => {
    const { usePathname } = await import('next/navigation')
    vi.mocked(usePathname).mockReturnValue('/hobbies')
    const { unmount } = render(<NavSidebar />)
    const hobbiesLink = screen.getByText('Hobbies').closest('a')
    expect(hobbiesLink?.className).toContain('bg-accent')
    unmount()
    vi.mocked(usePathname).mockReturnValue('/')
  })
})
