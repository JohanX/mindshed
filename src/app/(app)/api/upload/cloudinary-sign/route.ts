import crypto from 'crypto'
import { cookies } from 'next/headers'
import { z } from 'zod/v4'
import { isAuthEnabled } from '@/lib/auth'

/**
 * Story 35.5 / FR138 — Cloudinary signed direct-upload signature
 * endpoint. The browser POSTs `{ folder, resourceType }`, the server
 * returns the signature + the Cloudinary credentials the browser needs
 * to POST the file bytes directly to `api.cloudinary.com`. Vercel
 * never sees the file bytes — closes the ~4.5 MB Vercel platform-edge
 * body limit that rejected the 7.5 MB iPhone clip on 2026-05-15 (the
 * Story 35.4 prod incident).
 *
 * Mirrors the S3 presign-route auth + Zod-validation pattern (see
 * `../presign/route.ts`) so future readers find the symmetric shape.
 *
 * **Cloudinary signature spec (load-bearing):**
 *   https://cloudinary.com/documentation/upload_images#signed_upload_with_signature
 *
 * Signature = SHA-1( sorted_query_string(signed_params) + api_secret )
 *
 * Signed params for THIS endpoint: `{ folder, timestamp }`. The
 * UNsigned params Cloudinary expects in the upload POST but NOT in the
 * signature input are: `file`, `api_key`, `resource_type`, `cloud_name`,
 * `signature`. Adding or removing a signed param without updating both
 * sides results in HTTP 401 from Cloudinary's upload endpoint. The
 * signature-determinism unit test snapshots a known input/output pair
 * to detect drift.
 */

// `folder` is server-sandboxed: only `steps/<uuid-or-slug>` permitted in
// V1. Prevents a malicious client from writing into another tenant's
// folder or escaping the steps prefix. The slug regex accepts lowercase
// hex + dashes (UUID shape) since Story 35.1's step IDs are UUIDs.
const FOLDER_REGEX = /^steps\/[a-f0-9-]+$/

const signRequestSchema = z.object({
  folder: z.string().regex(FOLDER_REGEX, 'folder must match steps/<uuid>'),
  resourceType: z.enum(['image', 'video']),
})

function getCloudinaryEnv() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    return null
  }
  return { cloudName, apiKey, apiSecret }
}

/**
 * Build the Cloudinary signature for the upload POST.
 *
 * Exported for testability — the signature-determinism unit test
 * snapshots a known input/output pair without spinning up the route
 * handler.
 */
export function buildCloudinarySignature(opts: {
  folder: string
  timestamp: number
  apiSecret: string
}): string {
  // Cloudinary requires alphabetical sort by key. With only `folder` +
  // `timestamp` in the signed set, the canonical string is fixed; if a
  // future caller adds signed params, the sort here keeps the algorithm
  // correct.
  const signedParams: Record<string, string> = {
    folder: opts.folder,
    timestamp: String(opts.timestamp),
  }
  const canonical = Object.keys(signedParams)
    .sort()
    .map((key) => `${key}=${signedParams[key]}`)
    .join('&')
  return crypto
    .createHash('sha1')
    .update(canonical + opts.apiSecret)
    .digest('hex')
}

export async function POST(request: Request) {
  try {
    // Auth gate — same shape as the presign route. Reject anonymous
    // callers before doing any crypto work so a misconfigured client
    // can't probe signature derivation.
    if (isAuthEnabled()) {
      const cookieStore = await cookies()
      const authCookie = cookieStore.get('mindshed_auth')
      if (authCookie?.value !== 'authenticated') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const env = getCloudinaryEnv()
    if (!env) {
      return Response.json(
        {
          error:
            'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
        },
        { status: 501 },
      )
    }

    const body = await request.json()
    const parsed = signRequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      )
    }

    const { folder, resourceType } = parsed.data
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = buildCloudinarySignature({
      folder,
      timestamp,
      apiSecret: env.apiSecret,
    })

    return Response.json({
      timestamp,
      signature,
      apiKey: env.apiKey,
      cloudName: env.cloudName,
      folder,
      resourceType,
    })
  } catch (error) {
    console.error('Cloudinary sign failed:', error)
    return Response.json({ error: 'Failed to generate upload signature.' }, { status: 500 })
  }
}
