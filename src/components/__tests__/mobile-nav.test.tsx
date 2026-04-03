import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileNav } from '../layout/mobile-nav'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

describe('MobileNav', () => {
  it('renders all 3 navigation items', () => {
    render(<MobileNav />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Hobbies')).toBeInTheDocument()
    expect(screen.getByText('Ideas')).toBeInTheDocument()
  })

  it('highlights active item for dashboard route', () => {
    render(<MobileNav />)
    const dashboardLink = screen.getByText('Dashboard').closest('a')
    expect(dashboardLink?.className).toContain('text-primary')
  })

  it('highlights active item for hobbies route', async () => {
    const { usePathname } = await import('next/navigation')
    vi.mocked(usePathname).mockReturnValue('/hobbies')
    const { unmount } = render(<MobileNav />)
    const hobbiesLink = screen.getByText('Hobbies').closest('a')
    expect(hobbiesLink?.className).toContain('text-primary')
    unmount()
    vi.mocked(usePathname).mockReturnValue('/')
  })

  it('highlights active item for ideas route', async () => {
    const { usePathname } = await import('next/navigation')
    vi.mocked(usePathname).mockReturnValue('/ideas')
    const { unmount } = render(<MobileNav />)
    const ideasLink = screen.getByText('Ideas').closest('a')
    expect(ideasLink?.className).toContain('text-primary')
    unmount()
    vi.mocked(usePathname).mockReturnValue('/')
  })
})
