'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { resolveBlocker, updateBlocker, deleteBlocker } from '@/actions/blocker'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Pencil, Trash2, Check } from 'lucide-react'

interface BlockerCardProps {
  id: string
  description: string
}

export function BlockerCard({ id, description }: BlockerCardProps) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(description)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleResolve() {
    startTransition(async () => {
      const result = await resolveBlocker({ blockerId: id })
      if (result.success) {
        showSuccessToast('Blocker resolved')
      } else {
        showErrorToast(result.error)
      }
    })
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

  if (editing) {
    return (
      <form
        className="flex items-center gap-2 rounded-lg border border-border p-2 mb-2"
        onSubmit={(e) => { e.preventDefault(); handleEdit() }}
      >
        <Input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          maxLength={500}
          autoFocus
          className="flex-1 h-9"
        />
        <Button type="submit" size="sm" className="min-h-[44px]" disabled={!editText.trim() || isPending}>Save</Button>
        <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={() => { setEditing(false); setEditText(description) }}>Cancel</Button>
      </form>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border border-border p-2 mb-2">
        <p className="text-sm flex-1 min-w-0 truncate">{description}</p>
        <div className="flex items-center shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => { setEditing(true); setEditText(description) }}
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
            disabled={isPending}
            title="Resolve blocker"
            aria-label="Resolve blocker"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => { if (!v) setDeleteOpen(false) }}
        title="Delete this blocker?"
        description="This will permanently remove the blocker."
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  )
}
