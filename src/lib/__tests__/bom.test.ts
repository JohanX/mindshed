import { describe, it, expect } from 'vitest'
import { summarizeBomRows, renderAvailable, type BomItemData } from '../bom'

function linked(overrides: Partial<BomItemData> & { required: number; available: number | null; isDeleted?: boolean }): BomItemData {
  return {
    id: overrides.id ?? 'b1',
    label: null,
    requiredQuantity: overrides.required,
    unit: 'unit' in overrides ? (overrides.unit as string | null) : 'g',
    sortOrder: 0,
    consumptionState: overrides.consumptionState ?? 'NOT_CONSUMED',
    inventoryItem: {
      id: 'i1',
      name: 'Kaolin',
      type: 'MATERIAL',
      quantity: overrides.available,
      isDeleted: overrides.isDeleted ?? false,
    },
  }
}

function freeForm(overrides: Partial<BomItemData> & { required: number }): BomItemData {
  return {
    id: overrides.id ?? 'b2',
    label: overrides.label ?? 'Clay',
    requiredQuantity: overrides.required,
    unit: overrides.unit ?? null,
    sortOrder: 0,
    consumptionState: overrides.consumptionState ?? 'NOT_CONSUMED',
    inventoryItem: null,
  }
}

describe('summarizeBomRows', () => {
  it('empty → { total: 0, shortCount: 0, summary: "empty" }', () => {
    expect(summarizeBomRows([])).toEqual({ total: 0, shortCount: 0, summary: 'empty' })
  })

  it('one linked sufficient → ready', () => {
    const s = summarizeBomRows([linked({ required: 100, available: 500 })])
    expect(s).toEqual({ total: 1, shortCount: 0, summary: 'ready' })
  })

  it('one linked short → short with shortCount 1', () => {
    const s = summarizeBomRows([linked({ required: 500, available: 100 })])
    expect(s).toEqual({ total: 1, shortCount: 1, summary: 'short' })
  })

  it('two rows — one short, one consumed → shortCount 1 (consumed excluded)', () => {
    const s = summarizeBomRows([
      linked({ id: 'a', required: 500, available: 100 }),
      linked({ id: 'b', required: 200, available: 50, consumptionState: 'CONSUMED' }),
    ])
    expect(s).toEqual({ total: 2, shortCount: 1, summary: 'short' })
  })

  it('two rows — one short, one UNDONE → shortCount 1 (UNDONE excluded)', () => {
    const s = summarizeBomRows([
      linked({ id: 'a', required: 500, available: 100 }),
      linked({ id: 'b', required: 200, available: 50, consumptionState: 'UNDONE' }),
    ])
    expect(s).toEqual({ total: 2, shortCount: 1, summary: 'short' })
  })

  it('row linked to soft-deleted inventory is never short', () => {
    const s = summarizeBomRows([linked({ required: 500, available: 100, isDeleted: true })])
    expect(s).toEqual({ total: 1, shortCount: 0, summary: 'ready' })
  })

  it('free-form row is never short', () => {
    const s = summarizeBomRows([freeForm({ required: 500 })])
    expect(s).toEqual({ total: 1, shortCount: 0, summary: 'ready' })
  })

  it('all free-form → ready even with many rows', () => {
    const s = summarizeBomRows([
      freeForm({ id: 'a', required: 1 }),
      freeForm({ id: 'b', required: 2 }),
      freeForm({ id: 'c', required: 3 }),
    ])
    expect(s).toEqual({ total: 3, shortCount: 0, summary: 'ready' })
  })

  it('null quantity on linked inventory is never short', () => {
    const s = summarizeBomRows([linked({ required: 500, available: null })])
    expect(s).toEqual({ total: 1, shortCount: 0, summary: 'ready' })
  })

  it('exactly equal available and required → not short (>= is sufficient)', () => {
    const s = summarizeBomRows([linked({ required: 500, available: 500 })])
    expect(s).toEqual({ total: 1, shortCount: 0, summary: 'ready' })
  })
})

describe('renderAvailable', () => {
  it('linked sufficient → ok with "{qty} {unit}"', () => {
    expect(renderAvailable(linked({ required: 100, available: 600 }))).toEqual({
      label: '600 g',
      variant: 'ok',
    })
  })

  it('linked short → short with "(N short)" suffix', () => {
    expect(renderAvailable(linked({ required: 500, available: 50 }))).toEqual({
      label: '50 g (450 short)',
      variant: 'short',
    })
  })

  it('CONSUMED → consumed chip regardless of available/required', () => {
    expect(
      renderAvailable(linked({ required: 100, available: 0, consumptionState: 'CONSUMED' })),
    ).toEqual({ label: 'Consumed', variant: 'consumed' })
  })

  it('UNDONE → reverted chip', () => {
    expect(
      renderAvailable(linked({ required: 100, available: 50, consumptionState: 'UNDONE' })),
    ).toEqual({ label: 'Reverted', variant: 'undone' })
  })

  it('soft-deleted inventory → missing em-dash', () => {
    expect(
      renderAvailable(linked({ required: 100, available: 50, isDeleted: true })),
    ).toEqual({ label: '—', variant: 'missing' })
  })

  it('free-form row → missing em-dash', () => {
    expect(renderAvailable(freeForm({ required: 100 }))).toEqual({
      label: '—',
      variant: 'missing',
    })
  })

  it('linked with null quantity → missing em-dash', () => {
    expect(renderAvailable(linked({ required: 100, available: null }))).toEqual({
      label: '—',
      variant: 'missing',
    })
  })

  it('available quantity of 0 when required=0.0001 → short', () => {
    expect(renderAvailable(linked({ required: 0.0001, available: 0 }))).toEqual({
      label: '0 g (0.0001 short)',
      variant: 'short',
    })
  })

  it('no unit on row → label omits unit', () => {
    expect(renderAvailable(linked({ required: 1, available: 3, unit: null }))).toEqual({
      label: '3',
      variant: 'ok',
    })
  })
})
