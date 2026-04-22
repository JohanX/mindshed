'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { createShortageBlockers } from '@/actions/bom'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import {
  shortageRows,
  shortageFingerprint,
  type BomItemData,
} from '@/lib/bom'

interface ShortageBannerProps {
  projectId: string
  rows: BomItemData[]
  firstStepName: string | null
}

export function ShortageBanner({
  projectId,
  rows,
  firstStepName,
}: ShortageBannerProps) {
  const short = useMemo(() => shortageRows(rows), [rows])
  const fingerprint = useMemo(() => shortageFingerprint(rows), [rows])
  const [lastClickedFingerprint, setLastClickedFingerprint] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (short.length === 0) return null

  const alreadyBlockedForThisSet =
    lastClickedFingerprint !== null && lastClickedFingerprint === fingerprint
  const noSteps = firstStepName === null

  function handleClick() {
    if (noSteps || alreadyBlockedForThisSet) return
    startTransition(async () => {
      const result = await createShortageBlockers({ projectId })
      if (!result.success) {
        showErrorToast(result.error)
        return
      }
      setLastClickedFingerprint(fingerprint)
      const { created, skipped, stepName } = result.data
      if (created === 0 && skipped > 0) {
        showSuccessToast(`All shortages already blocked on Step ${stepName}.`)
      } else if (created > 0) {
        const noun = created === 1 ? 'blocker' : 'blockers'
        showSuccessToast(`${created} ${noun} added to Step ${stepName}.`)
      }
    })
  }

  const buttonLabel = noSteps
    ? 'Add a step first'
    : alreadyBlockedForThisSet
      ? '✓ Blockers created'
      : `Create blockers on Step ${firstStepName}`

  return (
    <div
      aria-live="polite"
      className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
        <span>
          {short.length === 1
            ? '1 item is short for this project.'
            : `${short.length} items are short for this project.`}
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant={alreadyBlockedForThisSet ? 'outline' : 'default'}
        className="min-h-[44px] shrink-0"
        disabled={isPending || noSteps || alreadyBlockedForThisSet}
        onClick={handleClick}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
          </>
        ) : alreadyBlockedForThisSet ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {buttonLabel}
          </>
        ) : (
          buttonLabel
        )}
      </Button>
    </div>
  )
}
