import { describe, it, expect } from 'vitest'
import { filterInventoryOptions, type InventoryOption } from '../bom'

function opt(name: string, type: InventoryOption['type'] = 'MATERIAL'): InventoryOption {
  return { id: name.toLowerCase().replace(/\s+/g, '-'), name, type, quantity: 0, unit: null }
}

describe('filterInventoryOptions', () => {
  it('empty query returns all options sorted alphabetically, showAddNew=false', () => {
    const { results, showAddNew } = filterInventoryOptions(
      [opt('Silica'), opt('Kaolin'), opt('Feldspar')],
      '',
    )
    expect(results.map((r) => r.name)).toEqual(['Feldspar', 'Kaolin', 'Silica'])
    expect(showAddNew).toBe(false)
  })

  it('case-insensitive substring match', () => {
    const { results } = filterInventoryOptions([opt('Kaolin'), opt('Silica')], 'kao')
    expect(results.map((r) => r.name)).toEqual(['Kaolin'])
  })

  it('ranks starts-with above contains', () => {
    const { results } = filterInventoryOptions(
      [opt('Old Kaolin'), opt('Kaolin'), opt('Kaolin Clay')],
      'kao',
    )
    expect(results.map((r) => r.name)).toEqual(['Kaolin', 'Kaolin Clay', 'Old Kaolin'])
  })

  it('no match returns empty results and showAddNew=true', () => {
    const { results, showAddNew } = filterInventoryOptions(
      [opt('Kaolin'), opt('Silica')],
      'feldspar',
    )
    expect(results).toEqual([])
    expect(showAddNew).toBe(true)
  })

  it('exact case-insensitive match hides Add New', () => {
    const { results, showAddNew } = filterInventoryOptions([opt('Kaolin')], 'KAOLIN')
    expect(results.map((r) => r.name)).toEqual(['Kaolin'])
    expect(showAddNew).toBe(false)
  })

  it('substring with exact also hides Add New', () => {
    const { showAddNew } = filterInventoryOptions(
      [opt('Kaolin'), opt('Kaolin Clay')],
      'Kaolin',
    )
    expect(showAddNew).toBe(false)
  })

  it('substring without exact shows Add New', () => {
    const { showAddNew } = filterInventoryOptions([opt('Kaolin Clay')], 'Kaolin')
    expect(showAddNew).toBe(true)
  })

  it('special characters in query do not break filtering', () => {
    const { results, showAddNew } = filterInventoryOptions(
      [opt('Project (A)'), opt('Project (B)')],
      '(a)',
    )
    expect(results.map((r) => r.name)).toEqual(['Project (A)'])
    expect(showAddNew).toBe(true) // "(a)" is not an exact match to "Project (A)"
  })

  it('trims query before matching', () => {
    const { results } = filterInventoryOptions([opt('Kaolin')], '   kaolin   ')
    expect(results.map((r) => r.name)).toEqual(['Kaolin'])
  })

  it('returns stable alpha order within each tier', () => {
    const { results } = filterInventoryOptions(
      [opt('B-item'), opt('A-item'), opt('C-item')],
      'item',
    )
    // All contain "item" as contains (none start-with because of the prefix letter)
    expect(results.map((r) => r.name)).toEqual(['A-item', 'B-item', 'C-item'])
  })
})
