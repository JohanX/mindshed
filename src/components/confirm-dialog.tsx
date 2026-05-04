'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-react'

// Build the progressive form for the loading label by stripping a single
// trailing silent 'e' before appending 'ing'. Handles the common confirm
// verbs — "Delete" → "Deleting", "Save" → "Saving", "Remove" → "Removing".
// Pass an explicit `loadingLabel` for irregular verbs.
function defaultLoadingLabel(confirmLabel: string): string {
  const stem = confirmLabel.endsWith('e') ? confirmLabel.slice(0, -1) : confirmLabel
  return `${stem}ing...`
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  loadingLabel?: string
  onConfirm: () => void
  loading?: boolean
  /**
   * `'destructive'` (default) styles the confirm button red — appropriate
   * for delete/remove flows. `'default'` styles it as the brand primary —
   * use for non-destructive confirmations like marking a project complete.
   */
  variant?: 'destructive' | 'default'
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loadingLabel,
  onConfirm,
  loading = false,
  variant = 'destructive',
}: ConfirmDialogProps) {
  const confirmClass =
    variant === 'destructive'
      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]'
      : 'min-h-[44px]'

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} className="min-h-[44px]">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={loading}
            className={confirmClass}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {loadingLabel ?? defaultLoadingLabel(confirmLabel)}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
