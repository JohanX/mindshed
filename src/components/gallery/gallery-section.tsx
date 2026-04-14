'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { enableJourneyGallery, disableJourneyGallery, enableResultGallery, disableResultGallery } from '@/actions/gallery'
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
  projectName: string
  journeyEnabled: boolean
  resultEnabled: boolean
  gallerySlug: string | null
  resultStepId: string | null
  steps: GalleryStep[]
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="truncate font-mono text-xs">{url}</span>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8"
        onClick={handleCopy}
        aria-label="Copy link"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}

export function GallerySection({
  projectId,
  projectName,
  journeyEnabled,
  resultEnabled,
  gallerySlug,
  resultStepId,
  steps,
}: GallerySectionProps) {
  const [isPending, startTransition] = useTransition()
  const [slug, setSlug] = useState(gallerySlug)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const journeyUrl = slug ? `${origin}/gallery/${slug}` : null
  const resultUrl = slug ? `${origin}/gallery/${slug}/result` : null

  function handleJourneyToggle(enabled: boolean) {
    startTransition(async () => {
      if (enabled) {
        const result = await enableJourneyGallery(projectId)
        if (result.success) {
          setSlug(result.data.slug)
          showSuccessToast('Journey gallery enabled')
        } else {
          showErrorToast(result.error)
        }
      } else {
        const result = await disableJourneyGallery(projectId)
        if (result.success) {
          showSuccessToast('Journey gallery disabled')
        } else {
          showErrorToast(result.error)
        }
      }
    })
  }

  function handleResultToggle(enabled: boolean) {
    startTransition(async () => {
      if (enabled) {
        const result = await enableResultGallery(projectId)
        if (result.success) {
          setSlug(result.data.slug)
          showSuccessToast('Result gallery enabled')
        } else {
          showErrorToast(result.error)
        }
      } else {
        const result = await disableResultGallery(projectId)
        if (result.success) {
          showSuccessToast('Result gallery disabled')
        } else {
          showErrorToast(result.error)
        }
      }
    })
  }

  const completedSteps = steps.filter(s => s.state === 'COMPLETED')

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Gallery</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Journey Gallery */}
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <label htmlFor="journey-toggle" className="text-sm font-medium">Journey Gallery</label>
            <Switch
              id="journey-toggle"
              checked={journeyEnabled}
              onCheckedChange={handleJourneyToggle}
              disabled={isPending}
              className="min-h-[44px]"
            />
          </div>
          {journeyEnabled && journeyUrl && (
            <div className="space-y-3">
              <CopyLinkButton url={journeyUrl} />
              <StepInclusionList steps={steps} />
            </div>
          )}
        </div>

        {/* Result Gallery */}
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <label htmlFor="result-toggle" className="text-sm font-medium">Result Gallery</label>
            <Switch
              id="result-toggle"
              checked={resultEnabled}
              onCheckedChange={handleResultToggle}
              disabled={isPending}
              className="min-h-[44px]"
            />
          </div>
          {resultEnabled && resultUrl && (
            <div className="space-y-3">
              <CopyLinkButton url={resultUrl} />
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
