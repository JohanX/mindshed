'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { updateProject, deleteProject, archiveProject } from '@/actions/project'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { MoreHorizontal, Pencil, Trash2, Archive, Loader2 } from 'lucide-react'

interface ProjectActionsProps {
  project: {
    id: string
    name: string
    description: string | null
    hobbyId: string
  }
}

export function ProjectActions({ project }: ProjectActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()

  function handleOpenEdit() {
    setName(project.name)
    setDescription(project.description ?? '')
    setEditOpen(true)
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    startTransition(async () => {
      const result = await updateProject({
        id: project.id,
        name: name.trim(),
        description: description.trim() || null,
      })
      if (result.success) {
        showSuccessToast('Project updated')
        setEditOpen(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteProject(project.id)
      if (result.success) {
        showSuccessToast('Project deleted')
        setDeleteOpen(false)
        router.push(`/hobbies/${result.data.hobbyId}`)
      } else {
        showErrorToast(result.error)
        setDeleteOpen(false)
      }
    })
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveProject(project.id)
      if (result.success) {
        showSuccessToast('Project archived')
        router.push(`/hobbies/${project.hobbyId}`)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Project actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-[44px]" onClick={(e) => { e.stopPropagation(); handleOpenEdit() }}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-[44px]" onClick={(e) => { e.stopPropagation(); handleArchive() }}>
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-[44px] text-destructive focus:text-destructive"
            onClick={(e) => { e.stopPropagation(); setDeleteOpen(true) }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Project Name</Label>
              <Input
                id="edit-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <Label htmlFor="edit-project-desc">Description</Label>
                <span className="text-xs text-muted-foreground">optional</span>
              </div>
              <Textarea
                id="edit-project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={!name.trim() || isPending} className="w-full">
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(v) => { if (!isDeleting) setDeleteOpen(v) }}
        title={`Delete ${project.name}?`}
        description="All steps, notes, and photos will be removed."
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </>
  )
}
