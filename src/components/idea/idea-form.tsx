'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { Idea } from '@/generated/prisma/client'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { createIdea, updateIdea } from '@/actions/idea'
import { createIdeaSchema, updateIdeaSchema } from '@/lib/schemas/idea'
import {
  getIdeaImage,
  addIdeaImageLink,
  deleteIdeaImage,
  type IdeaImageWithDisplayUrl,
} from '@/actions/idea-image'
import { uploadImage } from '@/lib/upload-image'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { ImageFormInputs } from '@/components/image/image-form-inputs'

/**
 * Story 27.2 (FR121): unified idea form covering both CREATE and EDIT
 * modes. Mirrors the `hobby-form.tsx` / `inventory-item-form.tsx`
 * pattern — one component, optional `idea?` prop, internal state if
 * uncontrolled (create), controlled `open`/`onOpenChange` if provided
 * (edit, opened from idea-actions-menu).
 *
 * Photo input is delegated to the shared `<ImageFormInputs>` component:
 * - Create mode → `mode='staged'`, value held in this component's state,
 *   committed after the idea is created (FR120 idempotent
 *   atomic-create-with-retry).
 * - Edit mode → `mode='live'`, fires actions immediately against the
 *   existing idea. The single-photo display (with delete) lives here
 *   and reloads via `getIdeaImage` when the dialog opens or after any
 *   image change.
 *
 * Idea image cap is 1 (FR113 + DB unique constraint on idea_image.ideaId).
 * The cap is enforced at the parent UI level: once a photo is staged or
 * an existing photo is loaded, the upload controls are hidden.
 */

type HobbyOption = { id: string; name: string; color: string }

type StagedPhoto =
  | { id: string; kind: 'file'; file: File; previewUrl: string }
  | { id: string; kind: 'url'; url: string }

type IdeaFormDialogProps = {
  idea?: Idea
  hobbyId?: string
  hobbies?: HobbyOption[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function IdeaFormDialog({
  idea,
  hobbyId,
  hobbies,
  open: controlledOpen,
  onOpenChange,
}: IdeaFormDialogProps) {
  const isEditMode = !!idea
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen

  const [selectedHobbyId, setSelectedHobbyId] = useState(idea?.hobbyId ?? hobbyId ?? '')
  const [title, setTitle] = useState(idea?.title ?? '')
  const [description, setDescription] = useState(idea?.description ?? '')
  const [referenceLink, setReferenceLink] = useState(idea?.referenceLink ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Create-mode only: staged photo (cap = 1) + idempotency cache.
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([])
  const [createdIdeaId, setCreatedIdeaId] = useState<string | null>(null)

  // Edit-mode only: single existing photo state.
  const [photo, setPhoto] = useState<IdeaImageWithDisplayUrl | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [deletePhotoOpen, setDeletePhotoOpen] = useState(false)
  const [isPhotoDeleting, startPhotoDeleteTransition] = useTransition()

  const effectiveHobbyId = isEditMode ? (idea?.hobbyId ?? '') : (hobbyId ?? selectedHobbyId)
  const isInRetryState = createdIdeaId !== null
  const stagedAtCap = stagedPhotos.length >= 1 // FR113: idea image cap is 1

  function revokeStagedFileUrls(photos: StagedPhoto[]) {
    for (const staged of photos) {
      if (staged.kind === 'file') URL.revokeObjectURL(staged.previewUrl)
    }
  }

  function resetCreateState() {
    setTitle('')
    setDescription('')
    setReferenceLink('')
    if (!hobbyId) setSelectedHobbyId('')
    revokeStagedFileUrls(stagedPhotos)
    setStagedPhotos([])
    setCreatedIdeaId(null)
    setError(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && idea) {
      // Re-prefill from idea on every open so external changes propagate.
      setTitle(idea.title)
      setDescription(idea.description ?? '')
      setReferenceLink(idea.referenceLink ?? '')
      setSelectedHobbyId(idea.hobbyId)
    }
    if (onOpenChange) {
      onOpenChange(nextOpen)
    } else {
      setInternalOpen(nextOpen)
    }
    if (!nextOpen && !isEditMode) {
      resetCreateState()
    }
  }

  // ----- Edit-mode photo loading -----
  const fetchPhoto = useCallback(async () => {
    if (!idea) return
    setPhotoLoading(true)
    const result = await getIdeaImage(idea.id)
    if (result.success) {
      setPhoto(result.data.image)
    } else {
      showErrorToast(result.error)
    }
    setPhotoLoading(false)
  }, [idea])

  useEffect(() => {
    // Same load-on-open pattern as inventory-item-form.tsx — one fetch
    // per open transition is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void fetchPhoto()
  }, [open, fetchPhoto])

  function handlePhotoDelete() {
    if (!idea) return
    startPhotoDeleteTransition(async () => {
      const result = await deleteIdeaImage(idea.id)
      if (result.success) {
        showSuccessToast('Photo deleted')
        setDeletePhotoOpen(false)
        await fetchPhoto()
      } else {
        showErrorToast(result.error)
        setDeletePhotoOpen(false)
      }
    })
  }

  // ----- Stage handlers (cap enforced in render: no controls when at cap) -----
  function handleStageFile(file: File) {
    setStagedPhotos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: 'file',
        file,
        previewUrl: URL.createObjectURL(file),
      },
    ])
  }
  function handleStageUrl(url: string) {
    setStagedPhotos((prev) => [...prev, { id: crypto.randomUUID(), kind: 'url', url }])
  }
  function handleUnstage(stagedId: string) {
    setStagedPhotos((prev) => {
      const removed = prev.find((staged) => staged.id === stagedId)
      if (removed?.kind === 'file') URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((staged) => staged.id !== stagedId)
    })
  }

  // ----- Submit -----
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (isEditMode && idea) {
      handleEditSubmit(idea.id)
    } else {
      handleCreateSubmit()
    }
  }

  function handleEditSubmit(ideaId: string) {
    const input = {
      id: ideaId,
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
        handleOpenChange(false)
      } else {
        setError(result.error)
        showErrorToast(result.error)
      }
    })
  }

  function handleCreateSubmit() {
    startTransition(async () => {
      let ideaId = createdIdeaId
      const hadStagedPhotosAtStart = stagedPhotos.length > 0

      // Step 1: create the idea if not yet created in this session.
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

      // Step 2: attach each staged photo, in order. Idea cap is 1 so the
      // queue has at most one entry, but the loop pattern is preserved
      // for parity with inventory and future-proofing.
      const queue = stagedPhotos
      for (const staged of queue) {
        const result =
          staged.kind === 'file'
            ? await uploadImage({ kind: 'idea', parentId: ideaId, file: staged.file })
            : await addIdeaImageLink({ ideaId, url: staged.url })
        if (!result.success) {
          const action = staged.kind === 'file' ? 'upload' : 'link'
          setError(`Photo ${action} failed: ${result.error}`)
          showErrorToast(`Photo ${action} failed: ${result.error}`)
          return
        }
        if (staged.kind === 'file') URL.revokeObjectURL(staged.previewUrl)
        setStagedPhotos((prev) => prev.filter((entry) => entry.id !== staged.id))
      }

      showSuccessToast(hadStagedPhotosAtStart ? 'Idea saved with photo' : 'Idea saved')
      resetCreateState()
      handleOpenChange(false)
    })
  }

  // ----- Submit button label / disabled state -----
  const isValid = isEditMode
    ? title.trim().length > 0
    : title.trim().length > 0 && effectiveHobbyId.length > 0

  function getSubmitLabel(): string {
    if (isPending) {
      if (isEditMode) return 'Saving…'
      if (isInRetryState) return 'Retrying photo…'
      return 'Saving…'
    }
    if (isEditMode) return 'Save'
    if (isInRetryState) return stagedPhotos.length > 0 ? 'Retry photo upload' : 'Done'
    return 'Save'
  }

  const submitDisabled = (() => {
    if (isPending) return true
    if (isEditMode) return !title.trim()
    if (isInRetryState) return false
    return !isValid
  })()

  const fieldsDisabled = !isEditMode && isInRetryState

  const dialogBody = (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEditMode ? 'Edit Idea' : 'Capture a new idea'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {!isEditMode && !hobbyId && hobbies && hobbies.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="idea-hobby">Hobby</Label>
            <Select
              value={selectedHobbyId}
              onValueChange={setSelectedHobbyId}
              disabled={fieldsDisabled}
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
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            autoFocus={!isEditMode}
            disabled={fieldsDisabled}
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
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={3}
            disabled={fieldsDisabled}
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
            onChange={(event) => setReferenceLink(event.target.value)}
            type="text"
            disabled={fieldsDisabled}
          />
        </div>

        {/* Create-mode photo section: controls on top, staged photo below
            (idea cap is 1, so once staged the controls disappear). */}
        {!isEditMode ? (
          <div className="space-y-2" data-testid="staged-photo-section">
            <span className="text-sm font-medium">Photo</span>
            <span className="ml-2 text-xs text-muted-foreground">optional</span>

            {!stagedAtCap && (
              <ImageFormInputs
                mode="staged"
                entityKind="idea"
                onStageFile={handleStageFile}
                onStageUrl={handleStageUrl}
                disabled={isPending}
              />
            )}

            {stagedPhotos.length > 0 && (
              <div
                className="grid grid-cols-[repeat(auto-fill,80px)] gap-2"
                data-testid="staged-photo-grid"
              >
                {stagedPhotos.map((staged) => (
                  <div key={staged.id} className="relative h-20 w-20 rounded-md">
                    <div className="h-full w-full overflow-hidden rounded-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={staged.kind === 'file' ? staged.previewUrl : staged.url}
                        alt="Staged photo preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white"
                      aria-label="Remove staged photo"
                      onClick={() => handleUnstage(staged.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitDisabled} className="w-full min-h-[44px]">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {getSubmitLabel()}
            </>
          ) : (
            getSubmitLabel()
          )}
        </Button>
      </form>

      {/* Edit-mode photo section: existing single photo + replace controls */}
      {isEditMode && idea && (
        <div className="space-y-3 border-t pt-4" data-testid="idea-photo-section">
          <span className="text-sm font-medium">Photo</span>

          {!photo && (
            <ImageFormInputs
              mode="live"
              entityKind="idea"
              entityId={idea.id}
              onChange={fetchPhoto}
            />
          )}

          {photoLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading photo...
            </div>
          )}

          {!photoLoading && photo && (
            <div className="relative inline-block" data-testid="idea-photo">
              <div className="h-24 w-24 overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.originalFilename ?? 'Idea photo'}
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                type="button"
                className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Delete photo"
                onClick={() => setDeletePhotoOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {!photoLoading && !photo && <p className="text-sm text-muted-foreground">No photo yet</p>}
        </div>
      )}

      <ConfirmDialog
        open={deletePhotoOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeletePhotoOpen(false)
        }}
        title="Delete this photo?"
        description="This cannot be undone."
        onConfirm={handlePhotoDelete}
        loading={isPhotoDeleting}
      />
    </DialogContent>
  )

  if (isEditMode) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {dialogBody}
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Idea
        </Button>
      </DialogTrigger>
      {dialogBody}
    </Dialog>
  )
}
