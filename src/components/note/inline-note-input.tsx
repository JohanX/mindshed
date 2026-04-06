'use client'

import { useState, useRef, useTransition } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createNoteSchema } from '@/lib/schemas/note'
import { addStepNote } from '@/actions/note'
import { cn } from '@/lib/utils'

interface InlineNoteInputProps {
  stepId: string
}

export function InlineNoteInput({ stepId }: InlineNoteInputProps) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function expand() {
    setExpanded(true)
    // Focus textarea after render
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }

  function collapse() {
    setExpanded(false)
    setText('')
    setError(null)
  }

  function handleSave() {
    const parsed = createNoteSchema.safeParse({ stepId, text })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await addStepNote({ stepId, text: parsed.data.text })
      if (result.success) {
        collapse()
      } else {
        setError(result.error)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
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
        data-testid="add-note-prompt"
      >
        Add a note...
      </button>
    )
  }

  return (
    <div className="space-y-2" data-testid="note-input-expanded">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write a note..."
        className="min-h-[80px]"
        maxLength={2000}
        disabled={isPending}
        aria-invalid={error ? true : undefined}
      />
      {error && (
        <p className="text-sm text-destructive" data-testid="note-input-error">
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
