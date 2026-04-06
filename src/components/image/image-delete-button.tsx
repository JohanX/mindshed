'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { deleteStepImage } from '@/actions/image'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

interface ImageDeleteButtonProps {
  imageId: string
  className?: string
}

export function ImageDeleteButton({ imageId, className }: ImageDeleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteStepImage(imageId)
      if (result.success) {
        showSuccessToast('Image deleted')
        setOpen(false)
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className={className}
        onClick={() => setOpen(true)}
        aria-label="Delete image"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete image"
        description="Delete this image? This can't be undone."
        confirmLabel="Delete"
        loadingLabel="Deleting..."
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  )
}
