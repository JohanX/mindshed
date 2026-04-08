import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'

function getR2Env() {
  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'Missing R2 environment variables. Ensure R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are set.'
    )
  }

  return { endpoint, accessKeyId, secretAccessKey, bucket }
}

let _client: S3Client | null = null
let _bucket: string | null = null

export function getR2Client(): S3Client {
  if (!_client) {
    const env = getR2Env()
    _client = new S3Client({
      region: 'auto',
      endpoint: env.endpoint,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
      forcePathStyle: true,
    })
    _bucket = env.bucket
  }
  return _client
}

export function getR2Bucket(): string {
  if (!_bucket) {
    const env = getR2Env()
    _bucket = env.bucket
  }
  return _bucket
}

export function getPublicUrl(storageKey: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL
  const bucket = process.env.R2_BUCKET_NAME
  if (publicUrl) {
    return `${publicUrl}/${bucket}/${storageKey}`
  }
  // Fallback for local dev (MinIO)
  const endpoint = process.env.R2_ENDPOINT
  if (!endpoint || !bucket) {
    throw new Error('Missing R2_PUBLIC_URL or R2_ENDPOINT/R2_BUCKET_NAME environment variables.')
  }
  return `${endpoint}/${bucket}/${storageKey}`
}

export async function deleteObject(storageKey: string): Promise<void> {
  const client = getR2Client()
  const bucket = getR2Bucket()
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }),
  )
}
