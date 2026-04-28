/**
 * FR117 + FR118 image count limits per parent entity.
 *
 * Server-side actions reject adds when the current count is >= the limit;
 * client-side UI hides/disables upload controls when at the cap. Existing
 * data above the cap is grandfathered (no auto-deletion) — adds resume
 * once the count drops below the limit.
 *
 * Idea images are capped at 1 by the `@@unique([ideaId])` constraint on
 * `idea_image` plus FR113. Not enforced via this constant — the DB
 * constraint IS the cap.
 */
export const IMAGE_LIMITS = {
  step: 5,
  inventory: 3,
} as const

export type ImageLimitKind = keyof typeof IMAGE_LIMITS

export function stepImageLimitError(): string {
  return `Step image limit reached (${IMAGE_LIMITS.step}).`
}

export function inventoryImageLimitError(): string {
  return `Inventory item image limit reached (${IMAGE_LIMITS.inventory}).`
}
