'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createIdea } from '@/actions/idea'
import { createIdeaSchema } from '@/lib/schemas/idea'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, Loader2 } from 'lucide-react'

type HobbyOption = { id: string; name: string; color: string }

type IdeaFormDialogProps = {
  hobbyId?: string
  hobbies?: HobbyOption[]
}

export function IdeaFormDialog({ hobbyId, hobbies }: IdeaFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedHobbyId, setSelectedHobbyId] = useState(hobbyId ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [referenceLink, setReferenceLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const effectiveHobbyId = hobbyId ?? selectedHobbyId

  function resetForm() {
    setTitle('')
    setDescription('')
    setReferenceLink('')
    setError(null)
    if (!hobbyId) setSelectedHobbyId('')
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen)
    if (!newOpen) resetForm()
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)

    const input = {
      hobbyId: effectiveHobbyId,
      title,
      description: description || null,
      referenceLink: referenceLink || null,
    }

    const parsed = createIdeaSchema.safeParse(input)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    startTransition(async () => {
      const result = await createIdea(parsed.data)
      if (result.success) {
        showSuccessToast('Idea saved')
        handleOpenChange(false)
      } else {
        setError(result.error)
        showErrorToast(result.error)
      }
    })
  }

  const isValid = title.trim().length > 0 && effectiveHobbyId.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Idea
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Capture a new idea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {!hobbyId && hobbies && hobbies.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="idea-hobby">Hobby</Label>
              <Select value={selectedHobbyId} onValueChange={setSelectedHobbyId}>
                <SelectTrigger id="idea-hobby">
                  <SelectValue placeholder="Select a hobby" />
                </SelectTrigger>
                <SelectContent>
                  {hobbies.map((hobby) => (
                    <SelectItem key={hobby.id} value={hobby.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: hobby.color }}
                        />
                        {hobby.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="idea-title">Title</Label>
            <Input
              id="idea-title"
              placeholder="What's the idea?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <Label htmlFor="idea-description">Description</Label>
              <span className="text-xs text-muted-foreground">optional</span>
            </div>
            <Textarea
              id="idea-description"
              placeholder="Add some details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <Label htmlFor="idea-link">Reference Link</Label>
              <span className="text-xs text-muted-foreground">optional</span>
            </div>
            <Input
              id="idea-link"
              placeholder="https://..."
              value={referenceLink}
              onChange={(e) => setReferenceLink(e.target.value)}
              type="text"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={!isValid || isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
