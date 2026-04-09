import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectCard, type ProjectCardData } from '../project/project-card'

const mockProject: ProjectCardData = {
  id: '123',
  name: 'Walnut Side Table',
  hobbyId: '456',
  totalSteps: 5,
  completedSteps: 2,
  currentStepName: 'Assembly',
  currentStepState: 'IN_PROGRESS',
  hasBlockedSteps: false,
}

const mockHobby = {
  name: 'Woodworking',
  color: 'hsl(25, 45%, 40%)',
  icon: 'hammer',
}

describe('ProjectCard', () => {
  it('renders project name', () => {
    render(<ProjectCard project={mockProject} />)
    expect(screen.getByText('Walnut Side Table')).toBeInTheDocument()
  })

  it('renders step progress', () => {
    render(<ProjectCard project={mockProject} />)
    expect(screen.getByText('2/5 steps')).toBeInTheDocument()
  })

  it('renders current step with badge', () => {
    render(<ProjectCard project={mockProject} />)
    expect(screen.getByText('Assembly')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('links to correct project URL', () => {
    const { container } = render(<ProjectCard project={mockProject} />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/hobbies/456/projects/123')
  })

  it('renders hobby-tinted background when hobby provided', () => {
    const { container } = render(<ProjectCard project={mockProject} hobby={mockHobby} />)
    const card = container.querySelector('[data-slot="card"]')
    expect(card).toBeInTheDocument()
    // Card should have an inline backgroundColor style (hobby tint)
    expect(card).toHaveStyle({ backgroundColor: expect.stringContaining('hsla') })
  })
})
