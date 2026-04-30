import { getImageStorageAdapter } from '@/lib/image-storage/adapter'

/**
 * Story 28.1 (FR122): best-effort post-commit cleanup of storage objects
 * (Cloudinary / S3) for image rows that were just hard-deleted via a
 * Prisma cascade. Used by `deleteIdea`, `deleteStep`, `deleteProject`,
 * `deleteHobby`, and (in Story 28.2) `deleteInventoryItem`.
 *
 * Contract — never throws:
 * - If the storage adapter is unavailable (`getImageStorageAdapter()`
 *   returns null), log a single `console.warn` and return. Orphans
 *   accumulate transiently and are reclaimed by Story 28.3's janitor.
 * - For each key, call `adapter.deleteObject(key)` inside a try/catch.
 *   Failures log via `console.error` and the loop continues.
 * - Null/undefined keys are skipped silently (defensive — the caller's
 *   query filter should already exclude them, but we don't trust it
 *   blindly).
 *
 * The deletes run sequentially rather than via `Promise.all` so a single
 * slow key can't block the others through bursty parallel adapter calls
 * — and we don't care about completion ordering. If throughput becomes a
 * concern (large cascades), revisit with bounded parallelism.
 *
 * Pattern reference: `src/actions/idea-image.ts:113-119` — the
 * single-key replace-on-add cleanup. This helper generalises that shape
 * to a list of keys.
 */
export async function cleanupStorageKeys(
  keys: ReadonlyArray<{ storageKey: string | null }>,
): Promise<void> {
  if (keys.length === 0) return

  const adapter = getImageStorageAdapter()
  if (!adapter) {
    console.warn('Storage cleanup skipped — adapter unavailable')
    return
  }

  for (const { storageKey } of keys) {
    if (!storageKey) continue
    try {
      await adapter.deleteObject(storageKey)
    } catch (error) {
      console.error('Storage cleanup failed:', error)
    }
  }
}
