'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateIdleThreshold } from '@/actions/settings'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { MIN_IDLE_THRESHOLD_DAYS, MAX_IDLE_THRESHOLD_DAYS } from '@/lib/schemas/settings'

interface IdleThresholdSettingProps {
  initialDays: number
}

export function IdleThresholdSetting({ initialDays }: IdleThresholdSettingProps) {
  const [savedDays, setSavedDays] = useState(initialDays)
  const [value, setValue] = useState(String(initialDays))
  const [isPending, startTransition] = useTransition()

  const parsed = Number.parseInt(value, 10)
  const isValid =
    Number.isInteger(parsed) &&
    parsed >= MIN_IDLE_THRESHOLD_DAYS &&
    parsed <= MAX_IDLE_THRESHOLD_DAYS
  const isDirty = parsed !== savedDays

  function handleSave() {
    if (!isValid || !isDirty) return
    startTransition(async () => {
      const result = await updateIdleThreshold({ days: parsed })
      if (result.success) {
        setSavedDays(result.data.days)
        showSuccessToast('Idle threshold updated')
      } else {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="idle-threshold-input">Idle threshold (days)</Label>
      <p className="text-sm text-muted-foreground">
        Projects with no activity for this many days are flagged as idle.
      </p>
      <div className="flex items-center gap-2">
        <Input
          id="idle-threshold-input"
          type="number"
          inputMode="numeric"
          min={MIN_IDLE_THRESHOLD_DAYS}
          max={MAX_IDLE_THRESHOLD_DAYS}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="max-w-[8rem]"
          aria-invalid={!isValid}
          aria-describedby={!isValid ? 'idle-threshold-error' : undefined}
        />
        <Button type="button" onClick={handleSave} disabled={!isValid || !isDirty || isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {!isValid && (
        <p id="idle-threshold-error" className="text-sm text-destructive">
          Enter a whole number between {MIN_IDLE_THRESHOLD_DAYS} and {MAX_IDLE_THRESHOLD_DAYS}.
        </p>
      )}
    </div>
  )
}
