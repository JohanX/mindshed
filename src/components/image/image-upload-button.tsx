'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'
import {
  uploadImageToStorage,
  ACCEPTED_STEP_MEDIA_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_SIZE_BYTES,
} from '@/lib/upload-image'
import { MAX_VIDEO_DURATION_SECONDS } from '@/lib/constants/image-upload'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

interface ImageUploadButtonProps {
  stepId: string
}

function isVideo(mime: string): boolean {
  return (ACCEPTED_VIDEO_TYPES as readonly string[]).includes(mime)
}

const READ_METADATA_TIMEOUT_MS = 5000

/**
 * Read `<video>.duration` off an off-DOM HTMLVideoElement. Used by
 * Story 35.2 to enforce the 60s cap client-side before any network
 * call. The object URL is revoked after measurement.
 *
 * Returns ceiling integer seconds (60.4s → 61, which the caller then
 * rejects as over-cap — `Math.round` would have silently passed it
 * through). Rejects with a generic Error if metadata can't be read
 * (e.g., corrupt file, unsupported codec) or if neither
 * `loadedmetadata` nor `error` fires within 5 s (iOS Safari quirk on
 * some fragmented MP4 / HEIC-tagged MOV files).
 */
async function readVideoDurationSeconds(file: File): Promise<number> {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = url
    await new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error('Timed out reading video metadata'))
      }, READ_METADATA_TIMEOUT_MS)
      video.onloadedmetadata = () => {
        window.clearTimeout(timeoutId)
        resolve()
      }
      video.onerror = () => {
        window.clearTimeout(timeoutId)
        reject(new Error('Could not read video metadata'))
      }
    })
    if (!Number.isFinite(video.duration)) {
      // iOS Safari can produce `duration === NaN` or `Infinity` on
      // malformed / fragmented MP4 without firing onerror. Treat as
      // unreadable so the caller surfaces a clear error instead of
      // letting NaN slip through the < 1 / > 60 comparisons (every
      // NaN comparison is false).
      throw new Error('Video duration is not finite')
    }
    return Math.ceil(video.duration)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ImageUploadButton({ stepId }: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleFile(file: File) {
    setIsUploading(true)
    try {
      let durationSeconds: number | null = null

      if (isVideo(file.type)) {
        // Story 35.2 / FR134: client-side size + duration guard.
        // Fails fast before any presign / network call so the user
        // sees instant feedback instead of an upload that's rejected
        // later by the server.
        if (file.size > MAX_VIDEO_SIZE_BYTES) {
          showErrorToast(`Video must be under ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024} MB.`)
          return
        }
        try {
          durationSeconds = await readVideoDurationSeconds(file)
        } catch {
          showErrorToast('Could not read video metadata. Try a different file.')
          return
        }
        if (durationSeconds < 1 || durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
          showErrorToast(`Video must be 1-${MAX_VIDEO_DURATION_SECONDS} seconds.`)
          return
        }
      }

      const result = await uploadImageToStorage({ stepId, file, durationSeconds })
      if (result.success) {
        showSuccessToast(isVideo(file.type) ? 'Video added' : 'Photo added')
      } else {
        showErrorToast(result.error)
      }
    } catch {
      showErrorToast('Upload failed — try again')
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_STEP_MEDIA_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Upload Photo
      </Button>
    </>
  )
}
