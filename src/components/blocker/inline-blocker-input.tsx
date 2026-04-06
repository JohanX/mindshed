'use client'

import { useState, useTransition, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createBlocker } from '@/actions/blocker'
import { createBlockerSchema } from '@/lib/schemas/blocker'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

interface InlineBlockerInputProps {
  stepId: string
}

export function InlineBlockerInput({ stepId }: InlineBlockerInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleOpen() {
    setIsOpen(true)
    // Focus textarea after render
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function handleCancel() {
    setIsOpen(false)
    setDescription('')
    setValidationError(null)
  }

  function handleSave() {
    const parsed = createBlockerSchema.safeParse({ stepId, description })
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    setValidationError(null)

    startTransition(async () => {
      const result = await createBlocker(parsed.data)
      if (result.success) {
        setIsOpen(false)
        setDescription('')
        showSuccessToast('Blocker added')
      } else {
        showErrorToast(result.error)
      }
    })
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        style={{ borderColor: 'hsl(220, 15%, 55%)', color: 'hsl(220, 15%, 55%)' }}
        onClick={handleOpen}
      >
        Add Blocker
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        placeholder="Describe what's blocking this step..."
        value={description}
        onChange={(e) => {
          setDescription(e.target.value)
          if (validationError) setValidationError(null)
        }}
        maxLength={500}
        aria-invalid={!!validationError}
        aria-describedby={validationError ? `blocker-error-${stepId}` : undefined}
        disabled={isPending}
        style={{ borderColor: validationError ? undefined : 'hsl(220, 15%, 55%)' }}
      />
      {validationError && (
        <p id={`blocker-error-${stepId}`} className="text-sm text-destructive">
          {validationError}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="min-h-[44px]"
          style={{ backgroundColor: 'hsl(220, 15%, 55%)' }}
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={handleCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
