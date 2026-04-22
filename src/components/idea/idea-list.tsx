'use client'

import { useState, useTransition } from 'react'
import type { Idea } from '@/generated/prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { IdeaEditDialog } from '@/components/idea/idea-edit-dialog'
import { promoteIdea, deleteIdea } from '@/actions/idea'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { ExternalLink, MoreHorizontal, Pencil, Trash2, ArrowUpRight } from 'lucide-react'

interface IdeaListProps {
  ideas: Idea[]
  hobbyId: string
}

export function IdeaList({ ideas }: IdeaListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ideas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} />
      ))}
    </div>
  )
}

function IdeaCard({ idea }: { idea: Idea }) {
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  function handlePromote() {
    startTransition(async () => {
      const result = await promoteIdea(idea.id)
      if (result.success) {
        showSuccessToast('Idea promoted to project')
      } else {
        showErrorToast(result.error)
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteIdea(idea.id)
      if (result.success) {
        showSuccessToast('Idea deleted')
        setDeleteOpen(false)
      } else {
        showErrorToast(result.error)
        setDeleteOpen(false)
      }
    })
  }

  return (
    <>
      <Card data-testid="idea-card" className={idea.isPromoted ? 'opacity-60' : ''}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              {idea.title}
              {idea.referenceLink && /^https?:\/\//.test(idea.referenceLink) && (
                <a
                  href={idea.referenceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Open reference link for ${idea.title}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </CardTitle>
            {!idea.isPromoted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Idea actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="min-h-[44px]" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="min-h-[44px]"
                    onClick={handlePromote}
                    disabled={isPending}
                  >
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Promote to Project
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="min-h-[44px] text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {idea.isPromoted && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded shrink-0">
                Promoted
              </span>
            )}
          </div>
        </CardHeader>
        {idea.description && (
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-3">{idea.description}</p>
          </CardContent>
        )}
      </Card>

      {editOpen && (
        <IdeaEditDialog key={idea.id} idea={idea} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => {
          if (!v) setDeleteOpen(false)
        }}
        title={`Delete "${idea.title}"?`}
        description="This idea will be permanently removed."
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  )
}
