import { cookies } from 'next/headers'
import { isAuthEnabled } from '@/lib/auth'
import { getR2Client, getR2Bucket } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
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

    const client = getR2Client()
    const bucket = getR2Bucket()

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })

    const url = await getSignedUrl(client, command, { expiresIn: 600 })

    return Response.json({ url, key })
  } catch (error) {
    console.error('Presign failed:', error)
    return Response.json({ error: 'Failed to generate upload URL.' }, { status: 500 })
  }
}
