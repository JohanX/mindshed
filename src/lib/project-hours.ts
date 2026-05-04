/**
 * Story 30.5 / FR129 — sum step.hoursLogged across a project's steps.
 *
 * Returns:
 *   null   → tracking is disabled at the hobby level. UI hides the total.
 *   number → sum, including 0. `formatHours` hides 0 from the UI separately.
 *
 * Prisma `Decimal(5,1)` arrives as `Prisma.Decimal`; we convert via
 * `.toNumber()`. The helper also accepts plain numeric inputs so unit tests
 * can use bare literals without constructing Decimal values. Tracking flag
 * is passed in by the caller (the data layer reads it from the parent
 * hobby) — keeps this helper decoupled from the Hobby shape.
 */

type StepHours = { hoursLogged: { toNumber: () => number } | number | null }

export function computeProjectTotalHours(
  steps: StepHours[],
  hobbyTracksHours: boolean,
): number | null {
  if (!hobbyTracksHours) return null
  let total = 0
  for (const step of steps) {
    if (step.hoursLogged == null) continue
    const value =
      typeof step.hoursLogged === 'number' ? step.hoursLogged : step.hoursLogged.toNumber()
    total += value
  }
  return total
}
