'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Upload, X } from 'lucide-react'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'
import { uploadImage, type ImageKind } from '@/lib/upload-image'
import { addInventoryItemImageLink } from '@/actions/inventory-image'
import { addIdeaImageLink } from '@/actions/idea-image'
import { addInventoryItemImageLinkSchema } from '@/lib/schemas/inventory-image'
import { addIdeaImageLinkSchema } from '@/lib/schemas/idea-image'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

/**
 * Story 27.1 (FR121): unified photo-input subcomponent shared by the
 * inventory item form and (in 27.2) the idea form. Replaces the narrower
 * `staged-photo-input.tsx` from Story 26.2 — adds Paste/Link parity AND
 * the live-mode that the edit dialogs use.
 *
 * Two modes via discriminated union on `mode`:
 *
 * - `mode='staged'` (create flow): the entity does not yet exist, so
 *   actions cannot be fired. The component STAGES the user's choice
 *   (File OR URL) in the parent's state via `onStageFile` / `onStageUrl`.
 *   The parent commits the staged value after the entity is created
 *   (see FR120 idempotent atomic-create-with-retry pattern in
 *   `inventory-item-form.tsx`). File and URL slots are mutually
 *   exclusive — the parent's stage handlers MUST clear the other slot
 *   when staging one (e.g. `onStageFile` calls
 *   `setStagedFile(file); setStagedUrl(null)`).
 *
 * - `mode='live'` (edit flow): the entity exists, so the component fires
 *   the appropriate server action immediately — `uploadImage` for files,
 *   `addInventoryItemImageLink` / `addIdeaImageLink` for URLs (whichever
 *   matches `entityKind`). Calls `onChange` after success so the parent
 *   can refetch / refresh.
 *
 * Renders TWO input affordances only — Upload + Paste/Link. NO dedicated
 * Camera / Take Photo button: `<input type="file" accept="image/*">`
 * already surfaces iOS's native action sheet ("Take Photo or Video" /
 * "Photo Library" / "Choose Files"), and forcing `capture="environment"`
 * on the picker denies users the library option.
 */

type StagedModeProps = {
  mode: 'staged'
  entityKind: ImageKind
  stagedFile: File | null
  stagedUrl: string | null
  onStageFile: (file: File) => void
  onStageUrl: (url: string) => void
  onClear: () => void
  disabled?: boolean
}

type LiveModeProps = {
  mode: 'live'
  entityKind: ImageKind
  entityId: string
  onChange: () => void | Promise<void>
  disabled?: boolean
}

export type ImageFormInputsProps = StagedModeProps | LiveModeProps

export function ImageFormInputs(props: ImageFormInputsProps) {
  const isStaged = props.mode === 'staged'
  const stagedFile = isStaged ? props.stagedFile : null
  const stagedUrl = isStaged ? props.stagedUrl : null
  const stagedAny = isStaged && (stagedFile !== null || stagedUrl !== null)

  return (
    <div className="space-y-2" data-testid="image-form-inputs">
      {stagedAny ? (
        <StagedPreview
          stagedFile={stagedFile}
          stagedUrl={stagedUrl}
          onClear={(props as StagedModeProps).onClear}
          disabled={(props as StagedModeProps).disabled}
        />
      ) : (
        <ImageInputControls {...props} />
      )}
    </div>
  )
}

function StagedPreview({
  stagedFile,
  stagedUrl,
  onClear,
  disabled,
}: {
  stagedFile: File | null
  stagedUrl: string | null
  onClear: () => void
  disabled?: boolean
}) {
  const filePreviewUrl = useMemo(
    () => (stagedFile ? URL.createObjectURL(stagedFile) : null),
    [stagedFile],
  )
  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    }
  }, [filePreviewUrl])

  const previewSrc = filePreviewUrl ?? stagedUrl ?? ''

  return (
    <div className="flex items-center gap-3" data-testid="image-form-inputs-preview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewSrc}
        alt="Staged photo preview"
        className="h-16 w-16 rounded-md object-cover ring-1 ring-border"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        onClick={onClear}
        disabled={disabled}
        aria-label="Remove staged photo"
      >
        <X className="mr-1 h-3.5 w-3.5" />
        Remove
      </Button>
    </div>
  )
}

function ImageInputControls(props: ImageFormInputsProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const [linkExpanded, setLinkExpanded] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [isLinkSaving, startLinkSavingTransition] = useTransition()

  const disabled = props.disabled ?? false

  function handleFile(file: File | null | undefined) {
    setFileError(null)
    setLinkError(null)
    if (!file) return
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setFileError('Only JPEG, PNG, and WebP images are allowed.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFileError('Image must be under 10 MB.')
      return
    }

    if (props.mode === 'staged') {
      props.onStageFile(file)
      return
    }

    void runLiveFileUpload(file, props)
  }

  async function runLiveFileUpload(file: File, liveProps: LiveModeProps) {
    setIsUploadingFile(true)
    try {
      const result = await uploadImage({
        kind: liveProps.entityKind,
        parentId: liveProps.entityId,
        file,
      })
      if (result.success) {
        showSuccessToast('Photo added')
        await liveProps.onChange()
      } else {
        showErrorToast(result.error)
      }
    } catch {
      showErrorToast('Upload failed — try again')
    } finally {
      setIsUploadingFile(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  function handlePastedFile(file: File) {
    handleFile(file)
    setLinkExpanded(false)
    setLinkUrl('')
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const clipboardItems = event.clipboardData?.items
    if (!clipboardItems) return
    for (const clipboardItem of clipboardItems) {
      if (clipboardItem.kind === 'file' && clipboardItem.type.startsWith('image/')) {
        event.preventDefault()
        const pastedFile = clipboardItem.getAsFile()
        if (pastedFile) handlePastedFile(pastedFile)
        return
      }
    }
  }

  function handleLinkSave() {
    setFileError(null)
    const schema =
      props.entityKind === 'idea' ? addIdeaImageLinkSchema : addInventoryItemImageLinkSchema
    // For staged mode we don't have an entityId yet — pass a synthetic UUID
    // just to satisfy the schema's shape; only the URL refinement matters
    // here (the real id check happens server-side at attach time).
    const placeholderId = '00000000-0000-0000-0000-000000000000'
    const candidatePayload =
      props.entityKind === 'idea'
        ? { ideaId: props.mode === 'live' ? props.entityId : placeholderId, url: linkUrl }
        : {
            inventoryItemId: props.mode === 'live' ? props.entityId : placeholderId,
            url: linkUrl,
          }
    const parsed = schema.safeParse(candidatePayload)
    if (!parsed.success) {
      setLinkError(parsed.error.issues[0]?.message ?? 'Invalid URL')
      return
    }
    setLinkError(null)

    if (props.mode === 'staged') {
      props.onStageUrl(parsed.data.url)
      setLinkExpanded(false)
      setLinkUrl('')
      return
    }

    runLiveLinkSave(parsed.data.url, props)
  }

  function runLiveLinkSave(url: string, liveProps: LiveModeProps) {
    startLinkSavingTransition(async () => {
      const result =
        liveProps.entityKind === 'idea'
          ? await addIdeaImageLink({ ideaId: liveProps.entityId, url })
          : await addInventoryItemImageLink({ inventoryItemId: liveProps.entityId, url })
      if (result.success) {
        showSuccessToast('Image added')
        setLinkExpanded(false)
        setLinkUrl('')
        await liveProps.onChange()
      } else {
        showErrorToast(result.error)
        setLinkError(result.error)
      }
    })
  }

  function handleLinkCancel() {
    setLinkExpanded(false)
    setLinkUrl('')
    setLinkError(null)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="image-form-inputs-file"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        disabled={disabled || isUploadingFile}
        onClick={() => uploadInputRef.current?.click()}
      >
        {isUploadingFile ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Upload
      </Button>

      {!linkExpanded ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          disabled={disabled}
          onClick={() => {
            setLinkExpanded(true)
            requestAnimationFrame(() => linkInputRef.current?.focus())
          }}
          data-testid="image-form-inputs-link-prompt"
        >
          Paste Image / Link
        </Button>
      ) : (
        <div className="w-full space-y-2">
          <Input
            ref={linkInputRef}
            type="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleLinkSave()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                handleLinkCancel()
              }
            }}
            onPaste={handlePaste}
            placeholder={isUploadingFile ? 'Uploading pasted image…' : 'Paste image or URL'}
            disabled={disabled || isLinkSaving || isUploadingFile}
            aria-invalid={linkError ? true : undefined}
            data-testid="image-form-inputs-link-input"
          />
          {linkError && <p className="text-sm text-destructive">{linkError}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="min-h-[44px]"
              onClick={handleLinkSave}
              disabled={disabled || isLinkSaving}
            >
              {isLinkSaving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={handleLinkCancel}
              disabled={disabled || isLinkSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {fileError && <p className="w-full text-sm text-destructive">{fileError}</p>}
    </div>
  )
}
