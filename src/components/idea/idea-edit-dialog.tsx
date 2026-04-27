'use client'

import { useState, useTransition, useEffect, useRef, useCallback } from 'react'
import type { Idea } from '@/generated/prisma/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { updateIdea } from '@/actions/idea'
import {
  getIdeaImage,
  addIdeaImageLink,
  deleteIdeaImage,
  type IdeaImageWithDisplayUrl,
} from '@/actions/idea-image'
import { addIdeaImageLinkSchema } from '@/lib/schemas/idea-image'
import { uploadIdeaImageToStorage } from '@/lib/upload-idea-image'
import { ACCEPTED_IMAGE_TYPES } from '@/lib/constants/image-upload'
import { updateIdeaSchema } from '@/lib/schemas/idea'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { Loader2, Upload, Trash2 } from 'lucide-react'

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

  const [photo, setPhoto] = useState<IdeaImageWithDisplayUrl | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [linkExpanded, setLinkExpanded] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [isLinking, startLinkTransition] = useTransition()
  const [deletePhotoOpen, setDeletePhotoOpen] = useState(false)
  const [isPhotoDeleting, startPhotoDeleteTransition] = useTransition()
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)

  const fetchPhoto = useCallback(async () => {
    setPhotoLoading(true)
    const result = await getIdeaImage(idea.id)
    if (result.success) {
      setPhoto(result.data.image)
    } else {
      showErrorToast(result.error)
    }
    setPhotoLoading(false)
  }, [idea.id])

  useEffect(() => {
    if (open) void fetchPhoto()
  }, [open, fetchPhoto])

  async function handlePhotoUpload(file: File) {
    if (isUploading) return
    setIsUploading(true)
    try {
      const result = await uploadIdeaImageToStorage({ ideaId: idea.id, file })
      if (result.success) {
        showSuccessToast('Photo added')
        await fetchPhoto()
      } else {
        showErrorToast(result.error)
      }
    } catch {
      showErrorToast('Upload failed — try again')
    } finally {
      setIsUploading(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  async function handlePastedFile(file: File) {
    setLinkError(null)
    await handlePhotoUpload(file)
    setLinkExpanded(false)
    setLinkUrl('')
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) void handlePastedFile(file)
        return
      }
    }
  }

  function handleLinkSave() {
    const parsed = addIdeaImageLinkSchema.safeParse({ ideaId: idea.id, url: linkUrl })
    if (!parsed.success) {
      setLinkError(parsed.error.issues[0]?.message ?? 'Invalid URL')
      return
    }
    setLinkError(null)
    startLinkTransition(async () => {
      const result = await addIdeaImageLink({ ideaId: idea.id, url: parsed.data.url })
      if (result.success) {
        showSuccessToast('Image added')
        setLinkExpanded(false)
        setLinkUrl('')
        await fetchPhoto()
      } else {
        showErrorToast(result.error)
        setLinkError(result.error)
      }
    })
  }

  function handlePhotoDelete() {
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

        <div className="space-y-3 border-t pt-4" data-testid="idea-photo-section">
          <span className="text-sm font-medium">Photo</span>

          <div className="flex flex-wrap gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handlePhotoUpload(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={isUploading}
              onClick={() => uploadInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {photo ? 'Replace Photo' : 'Upload Photo'}
            </Button>

            {!linkExpanded ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={() => {
                  setLinkExpanded(true)
                  requestAnimationFrame(() => linkInputRef.current?.focus())
                }}
                data-testid="add-idea-photo-link-prompt"
              >
                Paste Image / Link
              </Button>
            ) : (
              <div className="w-full space-y-2">
                <Input
                  ref={linkInputRef}
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleLinkSave()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setLinkExpanded(false)
                      setLinkUrl('')
                      setLinkError(null)
                    }
                  }}
                  onPaste={handlePaste}
                  placeholder={isUploading ? 'Uploading pasted image…' : 'Paste image or URL'}
                  disabled={isLinking || isUploading}
                  aria-invalid={linkError ? true : undefined}
                />
                {linkError && <p className="text-sm text-destructive">{linkError}</p>}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="min-h-[44px]"
                    onClick={handleLinkSave}
                    disabled={isLinking}
                  >
                    {isLinking ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => {
                      setLinkExpanded(false)
                      setLinkUrl('')
                      setLinkError(null)
                    }}
                    disabled={isLinking}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {photoLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading photo...
            </div>
          )}

          {!photoLoading && photo && (
            <div className="group relative inline-block" data-testid="idea-photo">
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
                className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete photo"
                onClick={() => setDeletePhotoOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {!photoLoading && !photo && <p className="text-sm text-muted-foreground">No photo yet</p>}
        </div>

        <ConfirmDialog
          open={deletePhotoOpen}
          onOpenChange={(v) => {
            if (!v) setDeletePhotoOpen(false)
          }}
          title="Delete this photo?"
          description="This cannot be undone."
          onConfirm={handlePhotoDelete}
          loading={isPhotoDeleting}
        />
      </DialogContent>
    </Dialog>
  )
}
