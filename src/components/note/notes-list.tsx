'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/format-date'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { updateStepNote, deleteStepNote } from '@/actions/note'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Pencil, Trash2 } from 'lucide-react'

interface NoteData {
  id: string
  text: string
  createdAt: Date
}

interface NotesListProps {
  notes: NoteData[]
  isProjectCompleted?: boolean
  className?: string
}

export function NotesList({ notes, isProjectCompleted, className }: NotesListProps) {
  if (notes.length === 0) return null

  return (
    <div className={cn('space-y-2', className)} data-testid="notes-list">
      {notes.map((note) => (
        <NoteItem key={note.id} note={note} isProjectCompleted={isProjectCompleted} />
      ))}
    </div>
  )
}

function NoteItem({ note, isProjectCompleted }: { note: NoteData; isProjectCompleted?: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(note.text)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleSave() {
    if (!editText.trim()) return
    startTransition(async () => {
      const result = await updateStepNote({ id: note.id, text: editText.trim() })
      if (result.success) {
        showSuccessToast('Note updated')
        setEditing(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteStepNote(note.id)
      if (result.success) {
        showSuccessToast('Note deleted')
        setDeleteOpen(false)
      } else {
        showErrorToast(result.error)
        setDeleteOpen(false)
      }
    })
  }

  if (editing) {
    return (
      <div className="rounded-lg bg-muted px-3 py-2 space-y-2" data-testid={`note-${note.id}`}>
        <Textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          maxLength={2000}
          autoFocus
          className="min-h-[60px]"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={!editText.trim() || isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditText(note.text) }}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="group rounded-lg bg-muted px-3 py-2 text-sm"
        data-testid={`note-${note.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="whitespace-pre-wrap break-words flex-1">{note.text}</p>
          {!isProjectCompleted && (
            // Actions stay visible (default opacity-80) on touch/mobile where
            // hover never fires — reviewer flagged 60% on the destructive
            // icon as a WCAG 1.4.11 non-text-contrast risk. Hover/focus
            // promote to full opacity for desktop discoverability.
            <div className="flex gap-1 shrink-0 opacity-80 hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => { setEditing(true); setEditText(note.text) }}
                title="Edit note"
                aria-label="Edit note"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] text-destructive"
                onClick={() => setDeleteOpen(true)}
                title="Delete note"
                aria-label="Delete note"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRelativeTime(note.createdAt)}
        </p>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => { if (!v) setDeleteOpen(false) }}
        title="Delete this note?"
        description="This note will be permanently removed."
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  )
}
