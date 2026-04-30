import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InventoryCombobox } from '../inventory-combobox'
import type { InventoryOption } from '@/lib/bom'

function makeOption(overrides: Partial<InventoryOption> = {}): InventoryOption {
  return {
    id: 'i1',
    name: 'Walnut Lumber',
    type: 'MATERIAL',
    quantity: 10,
    unit: 'boards',
    heroThumbnailUrl: null,
    ...overrides,
  }
}

describe('InventoryCombobox — thumbnail rendering', () => {
  function renderCombobox(options: InventoryOption[]) {
    return render(
      <InventoryCombobox
        options={options}
        onPickExisting={vi.fn()}
        onRequestNew={vi.fn()}
        onCancel={vi.fn()}
        autoFocus={false}
      />,
    )
  }

  it('renders the type-emoji fallback when an option has no heroThumbnailUrl', () => {
    renderCombobox([makeOption({ name: 'NoPhoto', heroThumbnailUrl: null })])
    // No <img> rendered for that row → check via container query.
    const list = screen.getByRole('listbox')
    expect(list.querySelector('img')).toBeNull()
    expect(list.textContent).toContain('NoPhoto')
    // The emoji fallback span carries the type-specific glyph.
    expect(list.textContent).toMatch(/🧱/)
  })

  it('renders an <img> when heroThumbnailUrl is present', () => {
    renderCombobox([
      makeOption({
        name: 'WithPhoto',
        heroThumbnailUrl: 'https://example.com/photo.jpg',
      }),
    ])
    const img = screen.getByRole('listbox').querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://example.com/photo.jpg')
    expect(img?.getAttribute('alt')).toBe('') // decorative
    expect(img?.getAttribute('loading')).toBe('lazy')
    expect(img?.getAttribute('width')).toBe('32')
    expect(img?.getAttribute('height')).toBe('32')
  })

  it('falls back to the emoji glyph when the image fails to load', () => {
    renderCombobox([
      makeOption({
        name: 'BrokenPhoto',
        type: 'TOOL',
        heroThumbnailUrl: 'https://example.com/missing.jpg',
      }),
    ])
    const img = screen.getByRole('listbox').querySelector('img')!
    expect(img).not.toBeNull()
    // Simulate the image failing to load.
    fireEvent.error(img)
    // After the error, the row should fall back to the type emoji and
    // remove the broken <img>.
    expect(screen.getByRole('listbox').querySelector('img')).toBeNull()
    expect(screen.getByRole('listbox').textContent).toMatch(/🔧/)
  })

  it('emits the correct emoji glyph per inventory type when no thumbnail', () => {
    renderCombobox([
      makeOption({ id: '1', name: 'M', type: 'MATERIAL', heroThumbnailUrl: null }),
      makeOption({ id: '2', name: 'C', type: 'CONSUMABLE', heroThumbnailUrl: null }),
      makeOption({ id: '3', name: 'T', type: 'TOOL', heroThumbnailUrl: null }),
    ])
    const text = screen.getByRole('listbox').textContent ?? ''
    expect(text).toMatch(/🧱/)
    expect(text).toMatch(/🧴/)
    expect(text).toMatch(/🔧/)
  })
})
