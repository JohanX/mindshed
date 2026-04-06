'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Loader2 } from 'lucide-react'
import { addStepImage } from '@/actions/image'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

interface ImageUploadButtonProps {
  stepId: string
}

export function ImageUploadButton({ stepId }: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const busy = isUploading || isPending

  async function handleFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showErrorToast('Only JPEG, PNG, and WebP images are allowed.')
      return
    }

    if (file.size > MAX_SIZE_BYTES) {
      showErrorToast('Image must be under 10 MB.')
      return
    }

    setIsUploading(true)

    try {
      // 1. Get presigned URL
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          filename: file.name,
          contentType: file.type,
        }),
      })

      if (!presignRes.ok) {
        throw new Error('Failed to get upload URL')
      }

      const { url, key } = (await presignRes.json()) as { url: string; key: string }

      // 2. Upload directly to R2/MinIO
      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error('Upload to storage failed')
      }

      // 3. Record the image via server action
      startTransition(async () => {
        const result = await addStepImage({
          stepId,
          storageKey: key,
          originalFilename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        })

        if (result.success) {
          showSuccessToast('Photo added')
        } else {
          showErrorToast(result.error)
        }
      })
    } catch {
      showErrorToast('Upload failed — try again')
    } finally {
      setIsUploading(false)
      // Reset input so the same file can be re-selected
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
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
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Camera className="mr-2 h-4 w-4" />
        )}
        Upload Photo
      </Button>
    </>
  )
}
