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

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  loadingLabel?: string
  onConfirm: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  loadingLabel,
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!loading) onOpenChange(v)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} className="min-h-[44px]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {loadingLabel ?? `${confirmLabel}ing...`}
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
