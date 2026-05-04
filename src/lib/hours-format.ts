/**
 * Story 30.5 / FR129 — format a per-project hours total for display.
 *
 * Hides 0 and null entirely (returns null) so cards don't render "0h" noise
 * for projects that haven't logged time yet OR that belong to a hobby with
 * tracking disabled. Integer values render without decimal (`6h`); fractional
 * values render with one decimal (`6.5h`). Inputs come from the data layer
 * via `computeProjectTotalHours` — never undefined in practice, but we
 * accept it defensively for safety in unit tests / partial mocks.
 */
export function formatHours(value: number | null | undefined): string | null {
  if (value === null || value === undefined || value === 0) return null
  return Number.isInteger(value) ? `${value}h` : `${value.toFixed(1)}h`
}
