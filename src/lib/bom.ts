export type BomConsumptionState = 'NOT_CONSUMED' | 'CONSUMED' | 'UNDONE'

export type BomItemData = {
  id: string
  label: string | null
  requiredQuantity: number
  unit: string | null
  sortOrder: number
  consumptionState: BomConsumptionState
  inventoryItem: {
    id: string
    name: string
    type: 'MATERIAL' | 'CONSUMABLE' | 'TOOL'
    quantity: number | null
    isDeleted: boolean
  } | null
}

export type BomSummary = {
  total: number
  shortCount: number
  summary: 'empty' | 'ready' | 'short'
}

/**
 * Count BOM rows and classify the project's BOM state for the status pill.
 *
 * A row is "short" when:
 *   - it is NOT_CONSUMED,
 *   - it is linked to a non-soft-deleted inventory item with a known quantity,
 *   - and inventoryItem.quantity < requiredQuantity.
 * Free-form rows (no inventoryItem) and rows with soft-deleted inventory cannot
 * be compared, so they count toward `total` but never toward `shortCount`.
 */
export function summarizeBomRows(rows: BomItemData[]): BomSummary {
  const total = rows.length
  let shortCount = 0
  for (const row of rows) {
    if (row.consumptionState !== 'NOT_CONSUMED') continue
    const inv = row.inventoryItem
    if (!inv || inv.isDeleted) continue
    if (inv.quantity === null) continue
    if (inv.quantity < row.requiredQuantity) shortCount += 1
  }
  const summary: BomSummary['summary'] =
    total === 0 ? 'empty' : shortCount > 0 ? 'short' : 'ready'
  return { total, shortCount, summary }
}

export type AvailableVariant = 'ok' | 'short' | 'missing' | 'consumed' | 'undone'

export type AvailableCell = {
  label: string
  variant: AvailableVariant
}

function formatQuantity(qty: number, unit: string | null): string {
  return unit ? `${qty} ${unit}` : `${qty}`
}

/**
 * Pure helper for rendering the Available column of a BOM row. The view layer
 * applies colors/icons based on `variant`; this function only produces the
 * textual label + classification.
 */
export function renderAvailable(row: BomItemData): AvailableCell {
  if (row.consumptionState === 'CONSUMED') {
    return { label: 'Consumed', variant: 'consumed' }
  }
  if (row.consumptionState === 'UNDONE') {
    return { label: 'Reverted', variant: 'undone' }
  }
  const inv = row.inventoryItem
  if (!inv || inv.isDeleted || inv.quantity === null) {
    return { label: '—', variant: 'missing' }
  }
  if (inv.quantity < row.requiredQuantity) {
    const shortBy = row.requiredQuantity - inv.quantity
    return {
      label: `${formatQuantity(inv.quantity, row.unit)} (${shortBy} short)`,
      variant: 'short',
    }
  }
  return { label: formatQuantity(inv.quantity, row.unit), variant: 'ok' }
}
