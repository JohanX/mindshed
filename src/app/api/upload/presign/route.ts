import { cookies } from 'next/headers'
import { isAuthEnabled } from '@/lib/auth'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'
import { z } from 'zod/v4'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const presignRequestSchema = z.object({
  stepId: z.uuid(),
  filename: z.string().min(1),
  contentType: z.enum(ALLOWED_TYPES),
})

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

    const { stepId, contentType } = parsed.data
    const ext = EXT_MAP[contentType]
    const key = `steps/${stepId}/${crypto.randomUUID()}.${ext}`

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
