/**
 * Story 35.4 / FR137 — MinIO test helpers for video round-trip + cascade
 * cleanup specs. Uses the AWS SDK directly against the local MinIO
 * instance configured by `.env.test` (R2_ENDPOINT, R2_BUCKET_NAME, etc).
 *
 * These helpers exist so cascade E2E tests can:
 *   (a) seed a real MinIO object at a storage key,
 *   (b) drive the actual deletion server-action through the UI,
 *   (c) assert HEAD on the storage key returns 404 — proving the
 *       cascade routed `mediaType: 'video'` through to `adapter.deleteObject`
 *       (Story 35.1 contract).
 *
 * Pre-existing `s3.ts` adapter is not used here because it throws on
 * `upload()` (presigned-URL flow only). For E2E, we PUT directly.
 */
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  NotFound,
} from '@aws-sdk/client-s3'

const ENDPOINT = process.env.R2_ENDPOINT ?? 'http://localhost:9000'
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID ?? 'mindshed'
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY ?? 'mindshed123'
const BUCKET = process.env.R2_BUCKET_NAME ?? 'mindshed-images'

let _client: S3Client | null = null
function getClient(): S3Client {
  if (_client) return _client
  _client = new S3Client({
    region: 'auto',
    endpoint: ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  })
  return _client
}

/**
 * PUT a synthetic byte buffer at `storageKey` in MinIO. Returns the
 * bucket + key so callers can confirm/log the placement.
 */
export async function putMinioObject(opts: {
  storageKey: string
  body: Buffer
  contentType: string
}): Promise<{ bucket: string; key: string }> {
  const client = getClient()
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: opts.storageKey,
      Body: opts.body,
      ContentType: opts.contentType,
    }),
  )
  return { bucket: BUCKET, key: opts.storageKey }
}

/**
 * HEAD a MinIO object. Returns `true` when the object exists (200), and
 * `false` when MinIO replies 404 (cascade-cleanup success path).
 *
 * Other errors propagate so genuine MinIO outages don't mask as a
 * passing cascade cleanup.
 */
export async function minioObjectExists(storageKey: string): Promise<boolean> {
  const client = getClient()
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: storageKey }))
    return true
  } catch (error) {
    if (error instanceof NotFound) return false
    // AWS SDK error envelopes are inconsistent across providers/versions;
    // also accept the duck-typed shape with `name === 'NotFound'` or
    // `$metadata.httpStatusCode === 404`.
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } }
    if (err?.name === 'NotFound') return false
    if (err?.$metadata?.httpStatusCode === 404) return false
    throw error
  }
}

/**
 * Best-effort DELETE for spec teardown. Idempotent — silently no-ops
 * when the object is already gone (i.e. the cascade did its job).
 */
export async function deleteMinioObject(storageKey: string): Promise<void> {
  const client = getClient()
  try {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storageKey }))
  } catch {
    /* idempotent teardown */
  }
}

/**
 * A minimum-viable MP4 byte buffer for tests. Constructs a 1-byte
 * "MP4-ish" placeholder — we never play these bytes back, we only need
 * MinIO to accept them as an object and report 200 on HEAD. The byte
 * count is intentionally tiny to keep S3 PUT latency negligible.
 *
 * Callers must NOT mount this in a `<video>` element and expect it to
 * play. For specs that need real playback assertions, use a fixture
 * MP4 from `e2e/fixtures/` instead.
 */
export function syntheticMp4Buffer(): Buffer {
  return Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])
}
