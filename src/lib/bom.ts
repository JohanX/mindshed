export type InventoryType = 'MATERIAL' | 'CONSUMABLE' | 'TOOL'

export type InventoryOption = {
  id: string
  name: string
  type: InventoryType
  quantity: number | null
  unit: string | null
}

export type FilteredCombobox = {
  results: InventoryOption[]
  showAddNew: boolean
}

/**
 * Pure filter for the inventory combobox: case-insensitive substring on name,
 * starts-with ranks above mid-name matches, stable alpha tie-breaker.
 * Returns a flag for whether to show the "Add new" option — hidden when any
 * result matches the query exactly (case-insensitive) so the user is forced
 * to reuse the existing inventory row.
 */
export function filterInventoryOptions(
  options: InventoryOption[],
  query: string,
): FilteredCombobox {
  const q = query.trim().toLowerCase()
  if (q === '') {
    return {
      results: [...options].sort((a, b) => a.name.localeCompare(b.name)),
      showAddNew: false,
    }
  }
  const starts: InventoryOption[] = []
  const contains: InventoryOption[] = []
  let exactMatch = false
  for (const o of options) {
    const lower = o.name.toLowerCase()
    if (lower === q) exactMatch = true
    if (lower.startsWith(q)) starts.push(o)
    else if (lower.includes(q)) contains.push(o)
  }
  starts.sort((a, b) => a.name.localeCompare(b.name))
  contains.sort((a, b) => a.name.localeCompare(b.name))
  return { results: [...starts, ...contains], showAddNew: !exactMatch }
}

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
 * Shared predicate: true when a BOM row is in shortage.
 *
 * A row is "short" when:
 *   - it is NOT_CONSUMED,
 *   - it is linked to a non-soft-deleted inventory item with a known quantity,
 *   - and inventoryItem.quantity < requiredQuantity.
 * Free-form rows (no inventoryItem) and rows with soft-deleted inventory cannot
 * be compared, so they never report as short.
 */
export function isRowShort(row: BomItemData): boolean {
  if (row.consumptionState !== 'NOT_CONSUMED') return false
  const inv = row.inventoryItem
  if (!inv || inv.isDeleted) return false
  if (inv.quantity === null) return false
  return inv.quantity < row.requiredQuantity
}

/**
 * Returns only the BOM rows that are currently short. Filter — preserves input
 * order so callers can render them in the same sort as the BOM table.
 */
export function shortageRows(rows: BomItemData[]): BomItemData[] {
  return rows.filter(isRowShort)
}

/**
 * Stable fingerprint of the current shortage set. Two renders produce the same
 * fingerprint iff the set of row ids in shortage is identical. Used by the UI
 * to know when to re-enable the "Create blockers" button after a prior click.
 */
export function shortageFingerprint(rows: BomItemData[]): string {
  return shortageRows(rows)
    .map((r) => r.id)
    .sort()
    .join('|')
}

/**
 * Builds the description text embedded in an auto-generated shortage Blocker.
 * Must be called with a row that is known to be short (linked inventory, known
 * quantity). Template mandated by spec AC #3.
 */
export function buildShortageBlockerDescription(row: BomItemData): string {
  const inv = row.inventoryItem
  if (!inv) throw new Error('buildShortageBlockerDescription requires a linked inventoryItem')
  const unit = row.unit ? ` ${row.unit}` : ''
  return `Need ${row.requiredQuantity}${unit} of ${inv.name} (have ${inv.quantity ?? 0})`
}

/**
 * Count BOM rows and classify the project's BOM state for the status pill.
 */
export function summarizeBomRows(rows: BomItemData[]): BomSummary {
  const total = rows.length
  let shortCount = 0
  for (const row of rows) {
    if (isRowShort(row)) shortCount += 1
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
