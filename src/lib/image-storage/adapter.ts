import { createS3Adapter } from './s3'
import { createCloudinaryAdapter } from './cloudinary'

export interface ImageStorageAdapter {
  /** Get the public display URL for a stored image (full resolution) */
  getPublicUrl(storageKey: string): string

  /**
   * Get an optimized thumbnail URL for a stored image.
   * Cloudinary: injects f_auto,q_auto,w_<width> transforms.
   * S3/R2: falls through to getPublicUrl (no URL-based transforms).
   */
  getThumbnailUrl(storageKey: string, width: number): string

  /**
   * Get the playable video URL for a stored video by its storage key (Epic 35).
   * Cloudinary: returns /video/upload/<key> (uses the video delivery pipeline).
   * S3/R2: returns the same public URL shape as images — browsers play MP4
   * natively from raw bytes regardless of CDN URL shape.
   */
  getVideoUrl(storageKey: string): string

  /**
   * Get a poster image URL derived from a stored video (Epic 35).
   * Cloudinary: returns /video/upload/so_auto,w_<width>,f_jpg/<key>.jpg —
   * so_auto picks a representative frame; f_jpg forces JPEG regardless of
   * source codec.
   * S3/R2: returns null — S3 has no transformation grammar. Callers MUST
   * handle null by rendering a generic play-icon card instead of a poster.
   */
  getVideoPosterUrl(storageKey: string, width: number): string | null

  /**
   * Delete a stored object by its storage key.
   *
   * `opts.mediaType` (Epic 35): when 'video', the Cloudinary adapter passes
   * resource_type:'video' to cloudinary.uploader.destroy. Load-bearing —
   * without it Cloudinary silently returns 'not found' and orphans the
   * video bytes. S3-compatible adapters ignore the opt.
   */
  deleteObject(storageKey: string, opts?: { mediaType?: 'image' | 'video' }): Promise<void>

  /**
   * Generate a presigned URL for direct client-to-storage upload (S3 mode only).
   * Cloudinary does not use presigned URLs — throws if called on Cloudinary adapter.
   */
  generatePresignedUrl(key: string, contentType: string): Promise<{ url: string; key: string }>

  /**
   * Upload a file from the server (Cloudinary mode).
   * S3 mode uses presigned URLs instead — throws if called on S3 adapter.
   *
   * `opts.mediaType` (Epic 35): when 'video', the Cloudinary adapter passes
   * resource_type:'video' to cloudinary.uploader.upload.
   */
  upload(
    file: Buffer,
    key: string,
    contentType: string,
    opts?: { mediaType?: 'image' | 'video' },
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
 * Whether the image provider handles its own optimization (format, quality, resize).
 * Cloudinary: true — URLs already include f_auto,q_auto,w_N transforms.
 * S3: true — dev uses private IPs unreachable by Next.js optimizer; prod R2 same.
 * Use this to set `unoptimized` on next/image components.
 */
export function isImageProviderSelfOptimized(): boolean {
  return !!getImageStorageAdapter()
}

/**
 * Reset the cached adapter instance (for testing only).
 * @internal
 */
export function _resetAdapter(): void {
  _adapter = undefined
}
