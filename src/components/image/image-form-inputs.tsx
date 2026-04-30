'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Upload } from 'lucide-react'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants/image-upload'
import { uploadImage, type ImageKind } from '@/lib/upload-image'
import { addInventoryItemImageLink } from '@/actions/inventory-image'
import { addIdeaImageLink } from '@/actions/idea-image'
import { addInventoryItemImageLinkSchema } from '@/lib/schemas/inventory-image'
import { addIdeaImageLinkSchema } from '@/lib/schemas/idea-image'
import { imageUrlSchema } from '@/lib/schemas/image-url'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

/**
 * Story 27.1 (FR121): unified photo-input controls — Upload + Paste/Link.
 * Renders only the input affordances (no preview, no list — the parent
 * owns the photo grid in both create and edit flows).
 *
 * Two modes via discriminated union on `mode`:
 *
 * - `mode='staged'` (create flow): the entity does not yet exist. The
 *   component fires `onStageFile` / `onStageUrl` with the picked value
 *   and the parent appends it to its staged-photos list. The parent
 *   renders the staged-photos grid (with X-icon corner delete) just like
 *   the edit-mode existing-photos grid — same look, different action.
 *
 * - `mode='live'` (edit flow): the entity exists, so the component fires
 *   the appropriate action immediately — `uploadImage` for files,
 *   `addInventoryItemImageLink` / `addIdeaImageLink` for URLs (whichever
 *   matches `entityKind`). Calls `onChange` after success so the parent
 *   can refetch.
 *
 * NO dedicated Camera / Take Photo button: `<input type="file"
 * accept="image/*">` already surfaces iOS's native action sheet ("Take
 * Photo or Video" / "Photo Library" / "Choose Files"), and forcing
 * `capture="environment"` on the picker denies users the library option.
 */

type StagedModeProps = {
  mode: 'staged'
  entityKind: ImageKind
  onStageFile: (file: File) => void
  onStageUrl: (url: string) => void
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
      if (uploadInputRef.current) uploadInputRef.current.value = ''
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

    if (props.mode === 'staged') {
      // Staged mode: validate just the URL (no entity id yet). The
      // shared `imageUrlSchema` is the single source of truth — both
      // action schemas (inventory + idea) compose it, so staged-mode
      // and live-mode validation can never drift.
      const parsed = imageUrlSchema.safeParse(linkUrl)
      if (!parsed.success) {
        setLinkError(parsed.error.issues[0]?.message ?? 'Invalid URL')
        return
      }
      setLinkError(null)
      props.onStageUrl(parsed.data)
      setLinkExpanded(false)
      setLinkUrl('')
      return
    }

    // Live mode: validate the full action input (entity id + URL).
    const liveSchema =
      props.entityKind === 'idea' ? addIdeaImageLinkSchema : addInventoryItemImageLinkSchema
    const livePayload =
      props.entityKind === 'idea'
        ? { ideaId: props.entityId, url: linkUrl }
        : { inventoryItemId: props.entityId, url: linkUrl }
    const parsed = liveSchema.safeParse(livePayload)
    if (!parsed.success) {
      setLinkError(parsed.error.issues[0]?.message ?? 'Invalid URL')
      return
    }
    setLinkError(null)
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
    <div className="space-y-2" data-testid="image-form-inputs">
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
      </div>

      {fileError && <p className="text-sm text-destructive">{fileError}</p>}
    </div>
  )
}
