'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { StepState } from '@/lib/step-states'
import { STEP_STATE_CONFIG } from '@/lib/step-states'
import type { BomItemData } from '@/lib/bom'
import { createBomShortageBlocker } from '@/actions/bom'
import { showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toast'

export interface PickerStep {
  id: string
  name: string
  state: StepState
  sortOrder: number
}

interface CreateBlockerDialogProps {
  open: boolean
  row: BomItemData | null
  steps: PickerStep[]
  onClose: () => void
}

function pickDefaultStepId(selectable: PickerStep[]): string | null {
  const inProgress = selectable.find((step) => step.state === 'IN_PROGRESS')
  if (inProgress) return inProgress.id
  const notStarted = selectable.find((step) => step.state === 'NOT_STARTED')
  if (notStarted) return notStarted.id
  return selectable[0]?.id ?? null
}

// Inner body is keyed on the row id so each open cycle mounts fresh state.
// Avoids setState-in-useEffect for "reset default step when dialog opens".
function DialogBody({
  row,
  steps,
  onClose,
}: {
  row: BomItemData
  steps: PickerStep[]
  onClose: () => void
}) {
  const selectable = useMemo(
    () =>
      [...steps]
        .filter((step) => step.state !== 'COMPLETED')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [steps],
  )
  const [selectedStepId, setSelectedStepId] = useState<string | null>(() =>
    pickDefaultStepId(selectable),
  )
  const [isPending, startTransition] = useTransition()

  const itemName = row.inventoryItem?.name ?? '(unnamed)'
  const allCompleted = selectable.length === 0

  function handleSubmit() {
    if (!selectedStepId) return
    startTransition(async () => {
      const result = await createBomShortageBlocker({
        bomItemId: row.id,
        stepId: selectedStepId,
      })
      if (!result.success) {
        showErrorToast(result.error)
        return
      }
      if (result.data.alreadyExisted) {
        showInfoToast(`Already blocked on ${result.data.stepName}.`)
      } else {
        showSuccessToast(`Blocker created on ${result.data.stepName}`)
      }
      onClose()
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Block: {itemName}</DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Which step needs this material?</p>

        {allCompleted ? (
          <p
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
          >
            All steps are completed — add a step first.
          </p>
        ) : (
          <Select
            value={selectedStepId ?? undefined}
            onValueChange={(v) => setSelectedStepId(v)}
            disabled={isPending}
          >
            <SelectTrigger aria-label="Target step" className="min-h-[44px] w-full">
              <SelectValue placeholder="Pick a step" />
            </SelectTrigger>
            <SelectContent>
              {selectable.map((step) => (
                <SelectItem key={step.id} value={step.id} className="min-h-[44px]">
                  <span className="flex items-center gap-2">
                    <span>{step.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({STEP_STATE_CONFIG[step.state].label})
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
          className="min-h-[44px]"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || allCompleted || !selectedStepId}
          className="min-h-[44px]"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            'Create blocker'
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export function CreateBlockerDialog({ open, row, steps, onClose }: CreateBlockerDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      {row && <DialogBody key={row.id} row={row} steps={steps} onClose={onClose} />}
    </Dialog>
  )
}
