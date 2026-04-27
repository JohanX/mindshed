'use client'

import { useState, useTransition } from 'react'
import type { Idea } from '@/generated/prisma/client'
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
import { MoreHorizontal, Pencil, Trash2, ArrowUpRight } from 'lucide-react'

interface IdeaActionsMenuProps {
  idea: Idea
}

export function IdeaActionsMenu({ idea }: IdeaActionsMenuProps) {
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

  if (idea.isPromoted) {
    return (
      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded shrink-0">
        Promoted
      </span>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] shrink-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Idea actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-[44px]" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-[44px]" onClick={handlePromote} disabled={isPending}>
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

      {editOpen && <IdeaEditDialog idea={idea} open={editOpen} onOpenChange={setEditOpen} />}

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
