'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, ImagePlus, X } from 'lucide-react'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'

/**
 * Story 26.2 (FR120): photo input that stages a single File in memory
 * for atomic commit alongside an item/idea create. No server upload
 * happens here — the file is just held until the parent form's submit
 * handler runs `uploadImage({ kind, parentId, file })`.
 *
 * Pre-staged state: Upload (gallery picker) + Camera (capture) buttons.
 * Post-staged state: small preview thumbnail + Remove button. Upload
 * controls are HIDDEN once a file is staged.
 *
 * URL-paste / external-link path is intentionally NOT supported in this
 * component — at create time we don't have a parent id to call
 * `addXImageLink` against. Users wanting a URL-photo can save the
 * item/idea first, then add the link via the edit dialog.
 */

interface StagedPhotoInputProps {
  stagedFile: File | null
  onStage: (file: File) => void
  onClear: () => void
  disabled?: boolean
}

export function StagedPhotoInput({
  stagedFile,
  onStage,
  onClear,
  disabled,
}: StagedPhotoInputProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  // Derive the blob URL during render so we don't call setState inside an
  // effect (which would trigger cascading renders). Cleanup runs when the
  // file changes or the component unmounts.
  const previewUrl = useMemo(
    () => (stagedFile ? URL.createObjectURL(stagedFile) : null),
    [stagedFile],
  )
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFile(file: File | null | undefined) {
    setError(null)
    if (!file) return
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are allowed.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('Image must be under 10 MB.')
      return
    }
    onStage(file)
  }

  function handleClear() {
    setError(null)
    onClear()
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  return (
    <div className="space-y-2" data-testid="staged-photo-input">
      <span className="text-sm font-medium">Photo</span>
      <span className="ml-2 text-xs text-muted-foreground">optional</span>

      {stagedFile && previewUrl ? (
        <div className="flex items-center gap-3" data-testid="staged-photo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Staged photo preview"
            className="h-16 w-16 rounded-md object-cover ring-1 ring-border"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Remove staged photo"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            ref={galleryInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            className="hidden"
            data-testid="staged-photo-file-input"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            data-testid="staged-photo-camera-input"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={disabled}
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImagePlus className="mr-1 h-4 w-4" />
            Upload
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={disabled}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="mr-1 h-4 w-4" />
            Camera
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
