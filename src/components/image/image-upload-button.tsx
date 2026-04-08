'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Loader2 } from 'lucide-react'
import { addStepImage, uploadImageCloudinary } from '@/actions/image'
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

  async function uploadViaS3(file: File) {
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
      // Only fall back to Cloudinary on 404 (not S3 mode) or 501 (no provider)
      // Other errors (400, 401, 500) are real S3 errors — don't silently switch providers
      if (presignRes.status === 404 || presignRes.status === 501) {
        return false // signal: not S3 mode, try Cloudinary
      }
      throw new Error('Failed to get upload URL')
    }

    const { url, key } = (await presignRes.json()) as { url: string; key: string }

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })

    if (!uploadRes.ok) {
      throw new Error('Upload to storage failed')
    }

    startTransition(async () => {
      const result = await addStepImage({
        stepId,
        storageKey: key,
        originalFilename: file.name,
        contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        sizeBytes: file.size,
      })

      if (result.success) {
        showSuccessToast('Photo added')
      } else {
        showErrorToast(result.error)
      }
    })

    return true // signal: S3 upload handled
  }

  async function uploadViaCloudinary(file: File) {
    const formData = new FormData()
    formData.append('stepId', stepId)
    formData.append('file', file)

    const result = await uploadImageCloudinary(formData)
    if (result.success) {
      showSuccessToast('Photo added')
    } else {
      showErrorToast(result.error)
    }
  }

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
      const handled = await uploadViaS3(file)
      if (!handled) {
        await uploadViaCloudinary(file)
      }
    } catch {
      showErrorToast('Upload failed — try again')
    } finally {
      setIsUploading(false)
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
