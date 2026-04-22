'use client'

import { useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { toggleStepGalleryExclusion } from '@/actions/gallery'
import { showErrorToast } from '@/lib/toast'
import type { GalleryStep } from '@/components/gallery/gallery-section'

interface StepInclusionListProps {
  steps: GalleryStep[]
}

export function StepInclusionList({ steps }: StepInclusionListProps) {
  const [isPending, startTransition] = useTransition()

  const stepsWithImages = steps.filter((step) => step.hasImages)

  if (stepsWithImages.length === 0) {
    return <p className="text-xs text-muted-foreground">No steps with images to include.</p>
  }

  function handleToggle(stepId: string) {
    startTransition(async () => {
      const result = await toggleStepGalleryExclusion(stepId)
      if (!result.success) {
        showErrorToast(result.error)
      }
    })
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">Include in journey:</p>
      {stepsWithImages.map((step) => (
        <div key={step.id} className="flex items-center justify-between gap-2 py-1">
          <span className="text-sm truncate">{step.name}</span>
          <Switch
            checked={!step.excludeFromGallery}
            onCheckedChange={() => handleToggle(step.id)}
            disabled={isPending}
            aria-label={`Include ${step.name} in gallery`}
          />
        </div>
      ))}
    </div>
  )
}
