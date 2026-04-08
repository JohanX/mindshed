import { v2 as cloudinary } from 'cloudinary'
import type { ImageStorageAdapter } from './adapter'

function ensureConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Missing Cloudinary environment variables. Ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set.',
    )
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  })
}

let _configured = false

class CloudinaryStorageAdapter implements ImageStorageAdapter {
  constructor() {
    if (!_configured) {
      ensureConfigured()
      _configured = true
    }
  }

  getPublicUrl(storageKey: string): string {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    if (!cloudName) {
      throw new Error('Missing CLOUDINARY_CLOUD_NAME environment variable.')
    }
    return `https://res.cloudinary.com/${cloudName}/image/upload/${storageKey}`
  }

  async deleteObject(storageKey: string): Promise<void> {
    await cloudinary.uploader.destroy(storageKey)
  }

  async generatePresignedUrl(
    _key: string,
    _contentType: string,
  ): Promise<{ url: string; key: string }> {
    throw new Error(
      'Cloudinary adapter does not support presigned URLs. Use upload() for server-side upload instead.',
    )
  }

  async upload(
    file: Buffer,
    key: string,
    contentType: string,
  ): Promise<{ publicUrl: string; storageKey: string }> {
    const ext = contentType.split('/')[1] || 'jpg'
    const dataUri = `data:${contentType};base64,${file.toString('base64')}`

    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: key.replace(/\.\w+$/, ''),
      folder: 'mindshed',
      resource_type: 'image',
      format: ext,
    })

    return {
      publicUrl: result.secure_url,
      storageKey: result.public_id,
    }
  }
}

export function createCloudinaryAdapter(): ImageStorageAdapter {
  return new CloudinaryStorageAdapter()
}
