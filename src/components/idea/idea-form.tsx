'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { getReadableHobbyColor } from '@/lib/hobby-color'
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
import { uploadImage } from '@/lib/upload-image'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, Loader2 } from 'lucide-react'
import { StagedPhotoInput } from '@/components/image/staged-photo-input'

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
  const [stagedPhoto, setStagedPhoto] = useState<File | null>(null)
  // FR120 idempotency: cache the just-created idea id so retries after
  // a photo-upload failure don't duplicate the idea.
  const [createdIdeaId, setCreatedIdeaId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const effectiveHobbyId = hobbyId ?? selectedHobbyId
  const isInRetryState = createdIdeaId !== null

  function resetForm() {
    setTitle('')
    setDescription('')
    setReferenceLink('')
    setStagedPhoto(null)
    setCreatedIdeaId(null)
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

    startTransition(async () => {
      let ideaId = createdIdeaId

      // Step 1: create the idea if not yet created in this dialog session.
      if (ideaId === null) {
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
        const result = await createIdea(parsed.data)
        if (!result.success) {
          setError(result.error)
          showErrorToast(result.error)
          return
        }
        ideaId = result.data.id
        setCreatedIdeaId(ideaId)
      }

      // Step 2: upload the staged photo if any.
      if (stagedPhoto) {
        const upload = await uploadImage({
          kind: 'idea',
          parentId: ideaId,
          file: stagedPhoto,
        })
        if (!upload.success) {
          // FR120 graceful-degradation: dialog stays open in retry state.
          setError(`Photo upload failed: ${upload.error}`)
          showErrorToast(`Photo upload failed: ${upload.error}`)
          return
        }
      }

      showSuccessToast(stagedPhoto ? 'Idea saved with photo' : 'Idea saved')
      handleOpenChange(false)
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
              <Select
                value={selectedHobbyId}
                onValueChange={setSelectedHobbyId}
                disabled={isInRetryState}
              >
                <SelectTrigger id="idea-hobby">
                  <SelectValue placeholder="Select a hobby" />
                </SelectTrigger>
                <SelectContent>
                  {hobbies.map((hobby) => (
                    <SelectItem key={hobby.id} value={hobby.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: getReadableHobbyColor(hobby.color) }}
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
              disabled={isInRetryState}
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
              disabled={isInRetryState}
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
              disabled={isInRetryState}
            />
          </div>

          <StagedPhotoInput
            stagedFile={stagedPhoto}
            onStage={setStagedPhoto}
            onClear={() => setStagedPhoto(null)}
            disabled={isPending}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={(!isInRetryState && !isValid) || isPending}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isInRetryState ? 'Retrying photo…' : 'Saving…'}
              </>
            ) : isInRetryState ? (
              stagedPhoto ? (
                'Retry photo upload'
              ) : (
                'Done'
              )
            ) : (
              'Save'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
