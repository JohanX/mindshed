import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopBar } from '../layout/top-bar'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

vi.mock('@/actions/hobby', () => ({
  createHobby: vi.fn(),
  updateHobby: vi.fn(),
}))

const mockHobbies = [
  {
    id: '1',
    name: 'Woodworking',
    color: 'hsl(25, 45%, 40%)',
    icon: 'hammer',
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    projectCount: 0,
    activeCount: 0,
    blockedCount: 0,
    idleCount: 0,
  },
]

describe('TopBar', () => {
  it('renders MindShed branding', () => {
    render(<TopBar hobbies={[]} />)
    expect(screen.getByText('MindShed')).toBeInTheDocument()
  })

  it('renders Dashboard link', () => {
    render(<TopBar hobbies={[]} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders Ideas link', () => {
    render(<TopBar hobbies={[]} />)
    expect(screen.getByText('Ideas')).toBeInTheDocument()
  })

  it('renders Settings gear link', () => {
    render(<TopBar hobbies={[]} />)
    expect(screen.getByTitle('Settings')).toBeInTheDocument()
  })

  it('renders hobby icons when hobbies provided', () => {
    render(<TopBar hobbies={mockHobbies} />)
    expect(screen.getByTitle('Woodworking')).toBeInTheDocument()
  })
})
