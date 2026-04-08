import { createS3Adapter } from './s3'
import { createCloudinaryAdapter } from './cloudinary'

export interface ImageStorageAdapter {
  /** Get the public display URL for a stored image */
  getPublicUrl(storageKey: string): string

  /** Delete a stored image by its storage key */
  deleteObject(storageKey: string): Promise<void>

  /**
   * Generate a presigned URL for direct client-to-storage upload (S3 mode only).
   * Cloudinary does not use presigned URLs — throws if called on Cloudinary adapter.
   */
  generatePresignedUrl(
    key: string,
    contentType: string,
  ): Promise<{ url: string; key: string }>

  /**
   * Upload a file from the server (Cloudinary mode).
   * S3 mode uses presigned URLs instead — throws if called on S3 adapter.
   */
  upload(
    file: Buffer,
    key: string,
    contentType: string,
  ): Promise<{ publicUrl: string; storageKey: string }>
}

let _adapter: ImageStorageAdapter | null | undefined

export function getImageStorageAdapter(): ImageStorageAdapter | null {
  if (_adapter !== undefined) return _adapter

  const provider = process.env.IMAGE_PROVIDER

  if (!provider) {
    console.warn(
      'IMAGE_PROVIDER is not set. Image uploads are disabled. Set IMAGE_PROVIDER to "cloudinary" or "s3".',
    )
    _adapter = null
    return null
  }

  if (provider === 's3') {
    _adapter = createS3Adapter()
    return _adapter
  }

  if (provider === 'cloudinary') {
    _adapter = createCloudinaryAdapter()
    return _adapter
  }

  console.warn(
    `IMAGE_PROVIDER="${provider}" is not a valid option. Use "cloudinary" or "s3". Image uploads are disabled.`,
  )
  _adapter = null
  return null
}

/**
 * Reset the cached adapter instance (for testing only).
 * @internal
 */
export function _resetAdapter(): void {
  _adapter = undefined
}
