import { cn } from '@/lib/utils'

interface NoteData {
  id: string
  text: string
  createdAt: Date
}

interface NotesListProps {
  notes: NoteData[]
  className?: string
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
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
