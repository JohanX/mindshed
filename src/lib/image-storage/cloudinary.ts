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

  getThumbnailUrl(storageKey: string, width: number): string {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    if (!cloudName) {
      throw new Error('Missing CLOUDINARY_CLOUD_NAME environment variable.')
    }
    return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_${width}/${storageKey}`
  }

  getVideoUrl(storageKey: string): string {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    if (!cloudName) {
      throw new Error('Missing CLOUDINARY_CLOUD_NAME environment variable.')
    }
    // Cloudinary's /video/upload/ pipeline is required for video URLs;
    // /image/upload/ would 404 for video assets.
    return `https://res.cloudinary.com/${cloudName}/video/upload/${storageKey}`
  }

  getVideoPosterUrl(storageKey: string, width: number): string {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    if (!cloudName) {
      throw new Error('Missing CLOUDINARY_CLOUD_NAME environment variable.')
    }
    // **CONTRACT (Story 35.3):** This method assumes the storageKey
    // belongs to a video asset. Cloudinary's public_id syntax does not
    // distinguish image vs video — both routes share the same key shape;
    // resource_type lives in the delivery URL prefix, not the key. So
    // this impl CANNOT refuse non-video keys. Calling with an IMAGE key
    // generates a URL that 404s at delivery time. Caller-side discipline
    // (gate on `mediaType === 'VIDEO'`) is the enforcement; the data
    // layer (`findStepImagesWithDisplayUrl`) is the canonical gate.
    //
    // so_auto picks a representative frame (Cloudinary heuristic — usually
    // a high-motion frame near the middle); f_jpg forces JPEG output
    // regardless of source codec; w_<width> sizes the poster for tile use.
    return `https://res.cloudinary.com/${cloudName}/video/upload/so_auto,w_${width},f_jpg/${storageKey}.jpg`
  }

  async deleteObject(storageKey: string, opts?: { mediaType?: 'image' | 'video' }): Promise<void> {
    // LOAD-BEARING: Cloudinary's destroy() defaults to resource_type:'image'.
    // Calling it on a video key without resource_type:'video' silently
    // returns { result: 'not found' } and orphans the video bytes — defeats
    // the FR122 cascade-cleanup contract for video (Story 35.1 / Epic 35).
    const resourceType = opts?.mediaType === 'video' ? 'video' : 'image'
    await cloudinary.uploader.destroy(storageKey, { resource_type: resourceType })
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
    opts?: { mediaType?: 'image' | 'video' },
  ): Promise<{ publicUrl: string; storageKey: string }> {
    const ext = contentType.split('/')[1] || 'jpg'
    const dataUri = `data:${contentType};base64,${file.toString('base64')}`
    const resourceType = opts?.mediaType === 'video' ? 'video' : 'image'

    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: key.replace(/\.\w+$/, ''),
      folder: 'mindshed',
      resource_type: resourceType,
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
