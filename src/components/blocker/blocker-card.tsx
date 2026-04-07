'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { resolveBlocker, updateBlocker, deleteBlocker } from '@/actions/blocker'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Pencil, Trash2 } from 'lucide-react'

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
        className="flex items-center gap-2 rounded-lg border p-3"
        style={{ borderColor: 'hsl(220, 15%, 55%)' }}
        onSubmit={(e) => { e.preventDefault(); handleEdit() }}
      >
        <Input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          maxLength={500}
          autoFocus
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={!editText.trim() || isPending}>Save</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setEditText(description) }}>Cancel</Button>
      </form>
    )
  }

  return (
    <>
      <div
        className="flex items-center justify-between gap-3 rounded-lg border p-3 mb-2"
        style={{ borderColor: 'hsl(220, 15%, 55%)' }}
      >
        <p className="text-sm flex-1">{description}</p>
        <div className="flex items-center gap-1 shrink-0">
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
            variant="outline"
            size="sm"
            className="shrink-0 min-h-[44px] transition-opacity motion-reduce:transition-none"
            style={{ borderColor: 'hsl(220, 15%, 55%)', color: 'hsl(220, 15%, 55%)' }}
            onClick={handleResolve}
            disabled={isPending}
          >
            {isPending ? 'Resolving...' : 'Resolve'}
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
