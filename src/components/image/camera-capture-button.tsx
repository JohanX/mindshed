'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Loader2 } from 'lucide-react'
import { uploadImageToStorage, ACCEPTED_TYPES } from '@/lib/upload-image'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

interface CameraCaptureButtonProps {
  stepId: string
}

export function CameraCaptureButton({ stepId }: CameraCaptureButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleFile(file: File) {
    setIsUploading(true)
    try {
      const result = await uploadImageToStorage({ stepId, file })
      if (result.success) {
        showSuccessToast('Photo captured')
      } else {
        showErrorToast(result.error)
      }
    } catch {
      showErrorToast('Capture failed — try again')
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
        accept={ACCEPTED_TYPES.join(',')}
        capture="environment"
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
          <Camera className="mr-2 h-4 w-4" />
        )}
        Take Photo
      </Button>
    </>
  )
}
