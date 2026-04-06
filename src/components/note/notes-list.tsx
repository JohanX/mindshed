import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/format-date'

interface NoteData {
  id: string
  text: string
  createdAt: Date
}

interface NotesListProps {
  notes: NoteData[]
  className?: string
}

export function NotesList({ notes, className }: NotesListProps) {
  if (notes.length === 0) return null

  return (
    <div className={cn('space-y-2', className)} data-testid="notes-list">
      {notes.map((note) => (
        <div
          key={note.id}
          className="rounded-lg bg-muted/50 px-3 py-2 text-sm"
          data-testid={`note-${note.id}`}
        >
          <p className="whitespace-pre-wrap break-words">{note.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatRelativeTime(note.createdAt)}
          </p>
        </div>
      ))}
    </div>
  )
}
