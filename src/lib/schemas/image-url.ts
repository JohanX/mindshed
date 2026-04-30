import { z } from 'zod/v4'

/**
 * Standalone image-URL validator. Used by:
 * - The shared `<ImageFormInputs>` in staged mode, where no entity id
 *   exists yet (the URL is queued in client state until the parent
 *   entity is created).
 * - `addInventoryItemImageLinkSchema` and `addIdeaImageLinkSchema`,
 *   composed via `.extend({ ... })` so the two action contracts share
 *   exactly one URL refinement and never drift.
 *
 * Replaces the previous "synthetic placeholder UUID" workaround that
 * fed `'00000000-...'` into the per-entity action schemas just to
 * exercise the URL branch — brittle to any future schema tightening.
 */
export const imageUrlSchema = z
  .url()
  .refine(
    (val) => val.startsWith('http://') || val.startsWith('https://'),
    'URL must start with http:// or https://',
  )
