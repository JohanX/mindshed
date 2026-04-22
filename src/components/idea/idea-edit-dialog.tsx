'use client'

import { useState, useTransition } from 'react'
import type { Idea } from '@/generated/prisma/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { updateIdea } from '@/actions/idea'
import { updateIdeaSchema } from '@/lib/schemas/idea'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

interface IdeaEditDialogProps {
  idea: Idea
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IdeaEditDialog({ idea, open, onOpenChange }: IdeaEditDialogProps) {
  const [title, setTitle] = useState(idea.title)
  const [description, setDescription] = useState(idea.description ?? '')
  const [referenceLink, setReferenceLink] = useState(idea.referenceLink ?? '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const input = {
      id: idea.id,
      title,
      description: description || null,
      referenceLink: referenceLink || null,
    }

    const parsed = updateIdeaSchema.safeParse(input)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    startTransition(async () => {
      const result = await updateIdea(parsed.data)
      if (result.success) {
        showSuccessToast('Idea updated')
        onOpenChange(false)
      } else {
        setError(result.error)
        showErrorToast(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Idea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-link">Reference Link</Label>
            <Input
              id="edit-link"
              value={referenceLink}
              onChange={(e) => setReferenceLink(e.target.value)}
              placeholder="https://..."
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
