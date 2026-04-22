'use client'

import { useState, useRef, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { addImageLinkSchema } from '@/lib/schemas/image'
import { addStepImageLink } from '@/actions/image'
import { uploadImageToStorage, ACCEPTED_TYPES } from '@/lib/upload-image'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

interface ImageLinkInputProps {
  stepId: string
}

export function ImageLinkInput({ stepId }: ImageLinkInputProps) {
  const [expanded, setExpanded] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = isPending || isUploading

  function expand() {
    setExpanded(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  function collapse() {
    setExpanded(false)
    setUrl('')
    setError(null)
  }

  function handleSave() {
    const parsed = addImageLinkSchema.safeParse({ stepId, url })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid URL')
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await addStepImageLink({ stepId, url: parsed.data.url })
      if (result.success) {
        showSuccessToast('Image added')
        collapse()
      } else {
        showErrorToast(result.error)
        setError(result.error)
      }
    })
  }

  async function handlePastedFile(file: File) {
    if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images can be pasted.')
      return
    }
    setError(null)
    setIsUploading(true)
    try {
      const result = await uploadImageToStorage({ stepId, file })
      if (result.success) {
        showSuccessToast('Pasted image added')
        collapse()
      } else {
        showErrorToast(result.error)
        setError(result.error)
      }
    } catch {
      showErrorToast('Upload failed — try again')
    } finally {
      setIsUploading(false)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) void handlePastedFile(file)
        return
      }
    }
    // Text paste — let the default handler populate the input
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      collapse()
    }
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        onClick={expand}
        data-testid="add-image-link-prompt"
      >
        Paste Image / Link
      </Button>
    )
  }

  return (
    <div className="space-y-2" data-testid="image-link-input-expanded">
      <Input
        ref={inputRef}
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={isUploading ? 'Uploading pasted image…' : 'Paste image or URL'}
        disabled={busy}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'image-link-input-error' : undefined}
      />
      {error && (
        <p
          id="image-link-input-error"
          className="text-sm text-destructive"
          data-testid="image-link-input-error"
        >
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="min-h-[44px]" onClick={handleSave} disabled={busy}>
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : isPending ? (
            'Saving...'
          ) : (
            'Save'
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={collapse}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
