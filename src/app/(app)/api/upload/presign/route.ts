import { cookies } from 'next/headers'
import { isAuthEnabled } from '@/lib/auth'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { z } from 'zod/v4'
import { ACCEPTED_STEP_MEDIA_TYPES, ACCEPTED_VIDEO_TYPES } from '@/lib/constants/image-upload'

// Story 35.2 / FR134 — video MIMEs accepted on the step prefix only.
// Idea + inventory remain IMAGE-only in V1.
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

const presignRequestSchema = z
  .object({
    prefix: z.enum(['steps', 'inventory', 'ideas']).default('steps'),
    stepId: z.uuid().optional(),
    inventoryItemId: z.uuid().optional(),
    ideaId: z.uuid().optional(),
    filename: z.string().min(1),
    contentType: z.enum(ACCEPTED_STEP_MEDIA_TYPES),
  })
  .refine(
    (data) =>
      (data.prefix === 'steps' && !!data.stepId) ||
      (data.prefix === 'inventory' && !!data.inventoryItemId) ||
      (data.prefix === 'ideas' && !!data.ideaId),
    {
      message: 'stepId required for steps prefix, inventoryItemId for inventory, ideaId for ideas',
    },
  )
  .refine(
    (data) => {
      // Video MIMEs are step-only — idea / inventory must reject them at
      // the presign boundary (FR134 V1 scope).
      const isVideo = (ACCEPTED_VIDEO_TYPES as readonly string[]).includes(data.contentType)
      if (!isVideo) return true
      return data.prefix === 'steps'
    },
    {
      message: 'Video uploads are supported only on step images',
      path: ['contentType'],
    },
  )

export async function POST(request: Request) {
  try {
    // Auth check — reject unauthenticated requests
    if (isAuthEnabled()) {
      const cookieStore = await cookies()
      const authCookie = cookieStore.get('mindshed_auth')
      if (authCookie?.value !== 'authenticated') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const adapter = getImageStorageAdapter()
    if (!adapter) {
      return Response.json(
        { error: 'Image storage is not configured. Set IMAGE_PROVIDER environment variable.' },
        { status: 501 },
      )
    }

    const body = await request.json()
    const parsed = presignRequestSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      )
    }

    const { prefix, stepId, inventoryItemId, ideaId, contentType } = parsed.data
    const ext = EXT_MAP[contentType]
    const parentId = prefix === 'steps' ? stepId : prefix === 'inventory' ? inventoryItemId : ideaId
    const key = `${prefix}/${parentId}/${crypto.randomUUID()}.${ext}`

    try {
      const result = await adapter.generatePresignedUrl(key, contentType)
      return Response.json({ url: result.url, key: result.key })
    } catch {
      // Adapter does not support presigned URLs (e.g., Cloudinary)
      return Response.json(
        { error: 'Presigned URLs are not supported by the current image provider.' },
        { status: 404 },
      )
    }
  } catch (error) {
    console.error('Presign failed:', error)
    return Response.json({ error: 'Failed to generate upload URL.' }, { status: 500 })
  }
}
