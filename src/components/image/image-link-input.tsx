'use client'

import { useState, useRef, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { addImageLinkSchema } from '@/lib/schemas/image'
import { addStepImageLink } from '@/actions/image'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface ImageLinkInputProps {
  stepId: string
}

export function ImageLinkInput({ stepId }: ImageLinkInputProps) {
  const [expanded, setExpanded] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

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
      <button
        type="button"
        className={cn(
          'flex w-full items-center min-h-[44px] px-3 py-2',
          'rounded-lg border border-dashed border-border',
          'text-sm text-muted-foreground',
          'hover:border-ring hover:text-foreground',
          'transition-colors cursor-pointer',
        )}
        onClick={expand}
        data-testid="add-image-link-prompt"
      >
        Add image link...
      </button>
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
        placeholder="https://example.com/image.jpg"
        disabled={isPending}
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
        <Button
          size="sm"
          className="min-h-[44px]"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={collapse}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
