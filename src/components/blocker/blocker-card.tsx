'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { resolveBlocker, updateBlocker, deleteBlocker } from '@/actions/blocker'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Check } from 'lucide-react'

interface BlockerCardProps {
  id: string
  description: string
  inventoryItem?: { name: string; type: string } | null
}

/**
 * How long the "resolved" UI is held before the server action fires.
 * Long enough for the eye to register the pulse + checkmark; short
 * enough that the user doesn't perceive a delay. Slightly longer than
 * `--anim-duration-medium` (220ms) so the keyframe completes inside
 * the hold window.
 */
const RESOLVED_HOLD_DURATION_MS = 500

export function BlockerCard({ id, description, inventoryItem }: BlockerCardProps) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(description)
  const [deleteOpen, setDeleteOpen] = useState(false)
  /**
   * Story 29.3 (retroactive): held-resolved feedback. On resolve, flip
   * to a "resolved" visual (checkmark + acknowledge pulse + green tint)
   * for ~500ms BEFORE calling the server action. The parent's
   * revalidate-driven re-render then unmounts the card naturally.
   * Without this hold, the only feedback was a toast — users reported
   * the card just "disappeared" without confirmation.
   */
  const [justResolved, setJustResolved] = useState(false)
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up the hold timer on unmount so a parent revalidate that
  // unmounts this card mid-hold doesn't leave a phantom timer firing
  // its setState/transition on a torn-down component.
  useEffect(() => {
    return () => {
      if (resolveTimerRef.current !== null) clearTimeout(resolveTimerRef.current)
    }
  }, [])

  function handleResolve() {
    if (justResolved || isPending) return // debounce double-clicks + retries-during-pending

    // prefers-reduced-motion: skip the held visual, fire the action
    // immediately. Mirrors the lightbox swipe's reduced-motion path.
    const reducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) {
      startTransition(async () => {
        const result = await resolveBlocker({ blockerId: id })
        if (result.success) showSuccessToast('Blocker resolved')
        else showErrorToast(result.error)
      })
      return
    }

    setJustResolved(true)
    resolveTimerRef.current = setTimeout(() => {
      resolveTimerRef.current = null
      startTransition(async () => {
        const result = await resolveBlocker({ blockerId: id })
        if (result.success) {
          showSuccessToast('Blocker resolved')
          // Card unmounts via parent revalidate; no further cleanup
          // needed here.
        } else {
          // Snap back so the user can retry from the normal UI.
          setJustResolved(false)
          showErrorToast(result.error)
        }
      })
    }, RESOLVED_HOLD_DURATION_MS)
  }

  function handleEdit() {
    if (!editText.trim()) return
    startTransition(async () => {
      const result = await updateBlocker({ id, description: editText.trim() })
      if (result.success) {
        showSuccessToast('Blocker updated')
        setEditing(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBlocker(id)
      if (result.success) {
        showSuccessToast('Blocker deleted')
        setDeleteOpen(false)
      } else {
        showErrorToast(result.error)
        setDeleteOpen(false)
      }
    })
  }

  if (justResolved) {
    // Held-resolved view: the new conditional branch mounts fresh on
    // the transition, so `anim-acknowledge-on-mount` triggers its
    // keyframe (the same pulse used on StepStateBadge / BOM consume).
    return (
      <div
        className="anim-acknowledge-on-mount mb-2 flex items-center gap-2 rounded-lg border border-step-completed bg-step-completed/10 p-2"
        data-testid="blocker-card-resolved"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-step-completed text-white">
          <Check className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm truncate text-muted-foreground line-through">{description}</p>
          <Badge
            variant="outline"
            className="mt-1 border-step-completed text-step-completed text-xs"
          >
            Resolved
          </Badge>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <form
        className="flex items-center gap-2 rounded-lg border border-border p-2 mb-2"
        onSubmit={(e) => {
          e.preventDefault()
          handleEdit()
        }}
      >
        <Input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          maxLength={500}
          autoFocus
          className="flex-1 h-9"
        />
        <Button
          type="submit"
          size="sm"
          className="min-h-[36px]"
          disabled={!editText.trim() || isPending}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[36px]"
          onClick={() => {
            setEditing(false)
            setEditText(description)
          }}
        >
          Cancel
        </Button>
      </form>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border border-border p-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{description}</p>
          {inventoryItem && (
            <Badge variant="outline" className="mt-1 text-xs">
              {inventoryItem.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => {
              setEditing(true)
              setEditText(description)
            }}
            title="Edit blocker"
            aria-label="Edit blocker"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] text-destructive"
            onClick={() => setDeleteOpen(true)}
            title="Delete blocker"
            aria-label="Delete blocker"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={handleResolve}
            disabled={isPending || justResolved}
            title="Resolve blocker"
            aria-label="Resolve blocker"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteOpen(false)
        }}
        title="Delete this blocker?"
        description="This will permanently remove the blocker."
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  )
}
