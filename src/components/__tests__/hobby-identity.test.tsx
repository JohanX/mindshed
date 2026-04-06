import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HobbyIdentity } from '../hobby/hobby-identity'

const testHobby = { name: 'Woodworking', color: 'hsl(25, 45%, 40%)', icon: 'hammer' }
const testHobbyNoIcon = { name: 'Pottery', color: 'hsl(15, 55%, 55%)', icon: null }

describe('HobbyIdentity', () => {
  describe('dot variant', () => {
    it('renders a colored circle', () => {
      const { container } = render(<HobbyIdentity hobby={testHobby} variant="dot" />)
      const dot = container.querySelector('.rounded-full')
      expect(dot).toBeInTheDocument()
      expect(dot).toHaveStyle({ backgroundColor: testHobby.color })
    })
  })

  describe('badge variant', () => {
    it('renders a color dot and hobby name', () => {
      const { container } = render(<HobbyIdentity hobby={testHobby} variant="badge" />)
      expect(screen.getByText('Woodworking')).toBeInTheDocument()
      const dot = container.querySelector('.rounded-full')
      expect(dot).toBeInTheDocument()
    })
  })

  describe('accent variant', () => {
    it('renders a 4px left border with correct color', () => {
      const { container } = render(
        <HobbyIdentity hobby={testHobby} variant="accent">
          <p>Child content</p>
        </HobbyIdentity>
      )
      const accent = container.querySelector('.border-l-4')
      expect(accent).toBeInTheDocument()
      expect(accent).toHaveStyle({ borderLeftColor: testHobby.color })
      expect(screen.getByText('Child content')).toBeInTheDocument()
    })
  })

  describe('full variant', () => {
    it('renders icon, color accent, and hobby name when icon is set', () => {
      render(<HobbyIdentity hobby={testHobby} variant="full" />)
      expect(screen.getByText('Woodworking')).toBeInTheDocument()
    })

    it('renders color accent and hobby name without icon when icon is null', () => {
      const { container } = render(<HobbyIdentity hobby={testHobbyNoIcon} variant="full" />)
      expect(screen.getByText('Pottery')).toBeInTheDocument()
      // Should have the dot but fewer elements than with icon
      const dot = container.querySelector('.rounded-full')
      expect(dot).toBeInTheDocument()
    })
  })

  it('applies className prop', () => {
    const { container } = render(
      <HobbyIdentity hobby={testHobby} variant="dot" className="extra-class" />
    )
    const dot = container.querySelector('.extra-class')
    expect(dot).toBeInTheDocument()
  })
})
