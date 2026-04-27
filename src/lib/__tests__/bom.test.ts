import { describe, it, expect } from 'vitest'
import {
  summarizeBomRows,
  renderAvailable,
  isRowShort,
  shortageRows,
  shortageFingerprint,
  buildShortageBlockerDescription,
  type BomItemData,
} from '../bom'

function linked(
  overrides: Partial<BomItemData> & {
    required: number
    available: number | null
    isDeleted?: boolean
  },
): BomItemData {
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

  it('CONSUMED → consumed chip + live qty in secondaryLabel', () => {
    expect(
      renderAvailable(linked({ required: 100, available: 0, consumptionState: 'CONSUMED' })),
    ).toEqual({ label: 'Consumed', variant: 'consumed', secondaryLabel: '0 g' })
  })

  it('CONSUMED with non-zero remaining qty → secondaryLabel reflects live stock', () => {
    expect(
      renderAvailable(linked({ required: 50, available: 250, consumptionState: 'CONSUMED' })),
    ).toEqual({ label: 'Consumed', variant: 'consumed', secondaryLabel: '250 g' })
  })

  it('CONSUMED with soft-deleted inventory → secondaryLabel is em-dash', () => {
    expect(
      renderAvailable(
        linked({ required: 100, available: 0, consumptionState: 'CONSUMED', isDeleted: true }),
      ),
    ).toEqual({ label: 'Consumed', variant: 'consumed', secondaryLabel: '—' })
  })

  it('CONSUMED with null inventory qty → secondaryLabel is em-dash', () => {
    expect(
      renderAvailable(linked({ required: 100, available: null, consumptionState: 'CONSUMED' })),
    ).toEqual({ label: 'Consumed', variant: 'consumed', secondaryLabel: '—' })
  })

  it('soft-deleted inventory → missing em-dash', () => {
    expect(renderAvailable(linked({ required: 100, available: 50, isDeleted: true }))).toEqual({
      label: '—',
      variant: 'missing',
    })
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

describe('isRowShort', () => {
  it('linked NOT_CONSUMED row with required > available → true', () => {
    expect(isRowShort(linked({ required: 500, available: 100 }))).toBe(true)
  })
  it('linked sufficient row → false', () => {
    expect(isRowShort(linked({ required: 100, available: 500 }))).toBe(false)
  })
  it('exact equality → false', () => {
    expect(isRowShort(linked({ required: 100, available: 100 }))).toBe(false)
  })
  it('CONSUMED row → false', () => {
    expect(isRowShort(linked({ required: 500, available: 0, consumptionState: 'CONSUMED' }))).toBe(
      false,
    )
  })
  it('free-form row → false', () => {
    expect(isRowShort(freeForm({ required: 500 }))).toBe(false)
  })
  it('soft-deleted inventory → false', () => {
    expect(isRowShort(linked({ required: 500, available: 0, isDeleted: true }))).toBe(false)
  })
  it('null quantity → false', () => {
    expect(isRowShort(linked({ required: 500, available: null }))).toBe(false)
  })
})

describe('shortageRows', () => {
  it('preserves input order while filtering to short rows only', () => {
    const rows = [
      linked({ id: 'a', required: 500, available: 100 }),
      linked({ id: 'b', required: 100, available: 500 }),
      linked({ id: 'c', required: 200, available: 50 }),
      freeForm({ id: 'd', required: 999 }),
    ]
    expect(shortageRows(rows).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('empty array → empty array', () => {
    expect(shortageRows([])).toEqual([])
  })
})

describe('shortageFingerprint', () => {
  it('empty set → empty string', () => {
    expect(shortageFingerprint([])).toBe('')
  })

  it('is stable across input reordering', () => {
    const a = linked({ id: 'a', required: 500, available: 100 })
    const b = linked({ id: 'b', required: 300, available: 50 })
    expect(shortageFingerprint([a, b])).toBe(shortageFingerprint([b, a]))
  })

  it('differs when shortage set membership changes', () => {
    const a = linked({ id: 'a', required: 500, available: 100 })
    const b = linked({ id: 'b', required: 300, available: 50 })
    const c = linked({ id: 'c', required: 200, available: 50 })
    expect(shortageFingerprint([a, b])).not.toBe(shortageFingerprint([a, b, c]))
  })

  it('matches when the same rows are included even with unrelated changes', () => {
    const a = linked({ id: 'a', required: 500, available: 100 })
    const b = linked({ id: 'b', required: 300, available: 50 })
    const sufficient = linked({ id: 'c', required: 100, available: 200 })
    // Adding a sufficient row does not change the fingerprint
    expect(shortageFingerprint([a, b])).toBe(shortageFingerprint([a, b, sufficient]))
  })
})

describe('buildShortageBlockerDescription', () => {
  it('includes unit when present', () => {
    expect(buildShortageBlockerDescription(linked({ required: 500, available: 50 }))).toBe(
      'Need 500 g of Kaolin (have 50)',
    )
  })

  it('omits unit when row.unit is null', () => {
    expect(buildShortageBlockerDescription(linked({ required: 1, available: 0, unit: null }))).toBe(
      'Need 1 of Kaolin (have 0)',
    )
  })

  it('treats null inventory.quantity as 0', () => {
    expect(buildShortageBlockerDescription(linked({ required: 5, available: null }))).toBe(
      'Need 5 g of Kaolin (have 0)',
    )
  })

  it('throws when called on a free-form row', () => {
    expect(() => buildShortageBlockerDescription(freeForm({ required: 1 }))).toThrow()
  })
})
