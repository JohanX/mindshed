import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HobbyCard } from '../hobby/hobby-card'
import type { HobbyWithCounts } from '@/lib/schemas/hobby'

const mockHobby: HobbyWithCounts = {
  id: '123',
  name: 'Woodworking',
  color: 'hsl(25, 45%, 40%)',
  icon: 'hammer',
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  projectCount: 3,
  activeCount: 2,
  blockedCount: 1,
  idleCount: 0,
}

const mockHobbyNoIcon: HobbyWithCounts = {
  ...mockHobby,
  id: '456',
  name: 'Pottery',
  icon: null,
  projectCount: 0,
}

describe('HobbyCard', () => {
  it('renders hobby name', () => {
    render(<HobbyCard hobby={mockHobby} />)
    expect(screen.getByText('Woodworking')).toBeInTheDocument()
  })

  it('renders project count', () => {
    render(<HobbyCard hobby={mockHobby} />)
    expect(screen.getByText('3 projects')).toBeInTheDocument()
  })

  it('renders singular project count', () => {
    render(<HobbyCard hobby={{ ...mockHobby, projectCount: 1 }} />)
    expect(screen.getByText('1 project')).toBeInTheDocument()
  })

  it('links to correct hobby URL', () => {
    const { container } = render(<HobbyCard hobby={mockHobby} />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/hobbies/123')
  })

  it('renders without icon when icon is null', () => {
    render(<HobbyCard hobby={mockHobbyNoIcon} />)
    expect(screen.getByText('Pottery')).toBeInTheDocument()
    expect(screen.getByText('0 projects')).toBeInTheDocument()
  })
})
