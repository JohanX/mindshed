import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  SkeletonDashboardSection,
  SkeletonStepCard,
  SkeletonBreadcrumb,
  SkeletonCard,
  SkeletonImageGallery,
} from '../skeletons'

describe('SkeletonDashboardSection', () => {
  it('renders a section header and 2 cards', () => {
    const { container } = render(<SkeletonDashboardSection />)
    const cards = container.querySelectorAll('.rounded-xl.border')
    expect(cards.length).toBe(2)
  })
})

describe('SkeletonStepCard', () => {
  it('renders with name and badge skeleton areas', () => {
    const { container } = render(<SkeletonStepCard />)
    const card = container.querySelector('.rounded-xl.border')
    expect(card).toBeInTheDocument()
    // Badge skeleton has rounded-full
    const badge = container.querySelector('.rounded-full')
    expect(badge).toBeInTheDocument()
  })
})

describe('SkeletonBreadcrumb', () => {
  it('renders separator elements', () => {
    const { container } = render(<SkeletonBreadcrumb />)
    const separators = container.querySelectorAll('.text-muted-foreground')
    expect(separators.length).toBe(2)
  })
})

describe('SkeletonCard', () => {
  it('renders with border and skeleton elements', () => {
    const { container } = render(<SkeletonCard />)
    const card = container.querySelector('.rounded-xl.border')
    expect(card).toBeInTheDocument()
  })
})

describe('SkeletonImageGallery', () => {
  it('renders 4 skeleton items', () => {
    const { container } = render(<SkeletonImageGallery />)
    const items = container.querySelectorAll('.aspect-square')
    expect(items.length).toBe(4)
  })
})
