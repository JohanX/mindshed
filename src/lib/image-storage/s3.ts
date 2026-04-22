import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ImageStorageAdapter } from './adapter'

function getS3Env() {
  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'Missing S3 environment variables. Ensure R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are set.',
    )
  }

  return { endpoint, accessKeyId, secretAccessKey, bucket }
}

let _client: S3Client | null = null
let _bucket: string | null = null

function getClient(): S3Client {
  if (!_client) {
    const env = getS3Env()
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

function getBucket(): string {
  if (!_bucket) {
    const env = getS3Env()
    _bucket = env.bucket
  }
  return _bucket
}

class S3StorageAdapter implements ImageStorageAdapter {
  getPublicUrl(storageKey: string): string {
    const publicUrl = process.env.R2_PUBLIC_URL
    const bucket = process.env.R2_BUCKET_NAME
    if (publicUrl) {
      return `${publicUrl}/${bucket}/${storageKey}`
    }
    const endpoint = process.env.R2_ENDPOINT
    if (!endpoint || !bucket) {
      throw new Error('Missing R2_PUBLIC_URL or R2_ENDPOINT/R2_BUCKET_NAME environment variables.')
    }
    return `${endpoint}/${bucket}/${storageKey}`
  }

  getThumbnailUrl(storageKey: string, _width: number): string {
    return this.getPublicUrl(storageKey)
  }

  async deleteObject(storageKey: string): Promise<void> {
    const client = getClient()
    const bucket = getBucket()
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }),
    )
  }

  async generatePresignedUrl(
    key: string,
    contentType: string,
  ): Promise<{ url: string; key: string }> {
    const client = getClient()
    const bucket = getBucket()

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })

    const url = await getSignedUrl(client, command, { expiresIn: 600 })
    return { url, key }
  }

  async upload(
    _file: Buffer,
    _key: string,
    _contentType: string,
  ): Promise<{ publicUrl: string; storageKey: string }> {
    throw new Error(
      'S3 adapter does not support server-side upload. Use generatePresignedUrl() for client-side direct upload.',
    )
  }
}

export function createS3Adapter(): ImageStorageAdapter {
  return new S3StorageAdapter()
}
