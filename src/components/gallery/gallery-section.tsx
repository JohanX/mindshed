'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import {
  enableJourneyGallery,
  disableJourneyGallery,
  enableResultGallery,
  disableResultGallery,
} from '@/actions/gallery'
import { showSuccessToast, showErrorToast } from '@/lib/toast'
import { StepInclusionList } from '@/components/gallery/step-inclusion-list'
import { ResultStepSelector } from '@/components/gallery/result-step-selector'

export interface GalleryStep {
  id: string
  name: string
  state: string
  hasImages: boolean
  excludeFromGallery: boolean
}

interface GallerySectionProps {
  projectId: string
  journeyEnabled: boolean
  resultEnabled: boolean
  gallerySlug: string | null
  resultStepId: string | null
  steps: GalleryStep[]
}

const NOOP_SUBSCRIBE = () => () => {}

function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  // The displayed URL needs `window.location.origin`, which is undefined
  // during SSR. Render the bare path on first paint so server + client
  // markup match, then resolve to the absolute URL after mount via the
  // SSR-safe useSyncExternalStore pattern (avoids setState-in-effect).
  const origin = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => window.location.origin,
    () => '',
  )
  const display = `${origin}${path}`

  async function handleCopy() {
    const absolute = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
    await navigator.clipboard.writeText(absolute)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
      <span className="truncate font-mono text-xs min-w-0">{display}</span>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 min-h-[44px] min-w-[44px]"
        onClick={handleCopy}
        aria-label="Copy link"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}

export function GallerySection({
  projectId,
  journeyEnabled,
  resultEnabled,
  gallerySlug,
  resultStepId,
  steps,
}: GallerySectionProps) {
  const [isPending, startTransition] = useTransition()
  const [slug, setSlug] = useState(gallerySlug)
  const [journeyOn, setJourneyOn] = useState(journeyEnabled)
  const [resultOn, setResultOn] = useState(resultEnabled)

  const journeyPath = slug ? `/gallery/${slug}` : null
  const resultPath = slug ? `/gallery/${slug}/result` : null

  function handleJourneyToggle(enabled: boolean) {
    setJourneyOn(enabled)
    startTransition(async () => {
      if (enabled) {
        const result = await enableJourneyGallery(projectId)
        if (result.success) {
          setSlug(result.data.slug)
          showSuccessToast('Journey gallery enabled')
        } else {
          setJourneyOn(false)
          showErrorToast(result.error)
        }
      } else {
        const result = await disableJourneyGallery(projectId)
        if (result.success) {
          showSuccessToast('Journey gallery disabled')
        } else {
          setJourneyOn(true)
          showErrorToast(result.error)
        }
      }
    })
  }

  function handleResultToggle(enabled: boolean) {
    setResultOn(enabled)
    startTransition(async () => {
      if (enabled) {
        const result = await enableResultGallery(projectId)
        if (result.success) {
          setSlug(result.data.slug)
          showSuccessToast('Result gallery enabled')
        } else {
          setResultOn(false)
          showErrorToast(result.error)
        }
      } else {
        const result = await disableResultGallery(projectId)
        if (result.success) {
          showSuccessToast('Result gallery disabled')
        } else {
          setResultOn(true)
          showErrorToast(result.error)
        }
      }
    })
  }

  const completedSteps = steps.filter((step) => step.state === 'COMPLETED')

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Gallery</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Journey Gallery */}
        <div className="space-y-3 rounded-lg border border-border p-4 min-w-0">
          <div className="flex items-center justify-between">
            <label htmlFor="journey-toggle" className="text-sm font-medium">
              Journey Gallery
            </label>
            <Switch
              id="journey-toggle"
              checked={journeyOn}
              onCheckedChange={handleJourneyToggle}
              disabled={isPending}
              className=""
            />
          </div>
          {journeyOn && journeyPath && (
            <div className="space-y-3">
              <CopyLinkButton path={journeyPath} />
              <StepInclusionList steps={steps} />
            </div>
          )}
        </div>

        {/* Result Gallery */}
        <div className="space-y-3 rounded-lg border border-border p-4 min-w-0">
          <div className="flex items-center justify-between">
            <label htmlFor="result-toggle" className="text-sm font-medium">
              Result Gallery
            </label>
            <Switch
              id="result-toggle"
              checked={resultOn}
              onCheckedChange={handleResultToggle}
              disabled={isPending}
              className=""
            />
          </div>
          {resultOn && resultPath && (
            <div className="space-y-3">
              <CopyLinkButton path={resultPath} />
              {completedSteps.length > 0 && (
                <ResultStepSelector
                  projectId={projectId}
                  steps={completedSteps}
                  resultStepId={resultStepId}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
