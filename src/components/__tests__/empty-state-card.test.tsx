import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyStateCard } from '../empty-state-card'

describe('EmptyStateCard', () => {
  it('renders message text', () => {
    render(<EmptyStateCard message="No hobbies yet" />)
    expect(screen.getByText('No hobbies yet')).toBeInTheDocument()
  })

  it('renders children when provided', () => {
    render(
      <EmptyStateCard message="Empty">
        <button>Add Item</button>
      </EmptyStateCard>,
    )
    expect(screen.getByText('Add Item')).toBeInTheDocument()
  })

  it('renders without children', () => {
    const { container } = render(<EmptyStateCard message="Nothing here" />)
    expect(container.querySelector('p')).toHaveTextContent('Nothing here')
  })
})
