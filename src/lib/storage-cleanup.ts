import { getImageStorageAdapter } from '@/lib/image-storage/adapter'

/**
 * Bound on how many `adapter.deleteObject` calls we run in flight at
 * once. Tuned for the typical hosted-image latency band (Cloudinary /
 * S3 ~100–300ms per delete). Sequential bottlenecks request threads on
 * large cascades; unbounded parallelism risks rate-limit pressure on
 * the storage provider. 8 keeps the worst-case wall time bounded while
 * staying well under typical provider QPS limits.
 */
const STORAGE_CLEANUP_CONCURRENCY = 8

/**
 * Module-level dedupe for the adapter-unavailable warning. Without this,
 * a misconfigured environment emits one warn per delete-action call;
 * once-per-process is enough to surface the misconfiguration.
 */
let warnedAdapterUnavailable = false

/**
 * Story 28.1 (FR122): best-effort post-commit cleanup of storage objects
 * (Cloudinary / S3) for image rows that were just hard-deleted via a
 * Prisma cascade. Used by `deleteIdea`, `deleteStep`, `deleteProject`,
 * `deleteHobby`, and (in Story 28.2) `deleteInventoryItem`.
 *
 * Contract — never throws:
 * - If the storage adapter is unavailable (`getImageStorageAdapter()`
 *   returns null), log a single `console.warn` (deduped per process)
 *   and return. Orphans accumulate transiently and are reclaimed by
 *   Story 28.3's janitor.
 * - For each key, call `adapter.deleteObject(key)` inside a try/catch.
 *   Failures log via `console.error` and the cleanup of remaining keys
 *   continues — one bad key never blocks the rest.
 * - Null/undefined keys are skipped silently (defensive — the caller's
 *   query filter should already exclude them, but we don't trust it
 *   blindly).
 *
 * Concurrency: runs deletes in chunks of `STORAGE_CLEANUP_CONCURRENCY`
 * via `Promise.allSettled`, so a slow individual key never serialises
 * the rest. Errors are swallowed per-key, not per-chunk.
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
    if (!warnedAdapterUnavailable) {
      console.warn('Storage cleanup skipped — adapter unavailable')
      warnedAdapterUnavailable = true
    }
    return
  }

  const validKeys = keys
    .map((entry) => entry.storageKey)
    .filter((storageKey): storageKey is string => storageKey !== null && storageKey !== undefined)

  for (let cursor = 0; cursor < validKeys.length; cursor += STORAGE_CLEANUP_CONCURRENCY) {
    const chunk = validKeys.slice(cursor, cursor + STORAGE_CLEANUP_CONCURRENCY)
    await Promise.allSettled(
      chunk.map((storageKey) =>
        adapter.deleteObject(storageKey).catch((error: unknown) => {
          // Per-key catch so one bad key in a chunk doesn't reject the
          // outer promise (allSettled would log the rejection; we want
          // a clean console.error path that matches the sequential
          // version's contract).
          console.error('Storage cleanup failed:', error)
        }),
      ),
    )
  }
}
