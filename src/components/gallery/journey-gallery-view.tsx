'use client'

import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Play } from 'lucide-react'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { ImageLightbox } from '@/components/image/image-lightbox'
import type { GalleryImage } from '@/components/image/image-gallery'
import { useMotionTokens } from '@/lib/motion/motion-tokens'
import { cn } from '@/lib/utils'

interface JourneyStep {
  name: string
  notes: { text: string }[]
  images: {
    displayUrl: string
    thumbnailUrl?: string
    originalFilename: string | null
    // Story 35.4 / FR137: optional media-type discriminator + video
    // metadata + poster URL. Undefined = implicit IMAGE (back-compat
    // for any future caller that doesn't surface these).
    mediaType?: 'IMAGE' | 'VIDEO'
    durationSeconds?: number | null
    posterUrl?: string | null
  }[]
}

interface JourneyGalleryViewProps {
  project: {
    name: string
    description: string | null
    hobby: { name: string; color: string; icon: string | null }
    /** Story 30.5 / FR129 — pre-formatted total like `12.5h`, or null to hide. */
    totalHoursLabel: string | null
  }
  steps: JourneyStep[]
}

export function JourneyGalleryView({ project, steps }: JourneyGalleryViewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const tokens = useMotionTokens()

  // Flatten all images across steps with step context for the lightbox.
  // Story 29.4 / FR124: caption metadata travels with each image; the
  // unified ImageLightbox renders the caption block when current.caption
  // is set. Index is used as the synthetic id (stable for the lifetime
  // of the lightbox session).
  const allImages: GalleryImage[] = steps.flatMap((step, stepIdx) =>
    step.images.map((img, imgIdx) => ({
      id: `journey-${stepIdx}-${imgIdx}`,
      displayUrl: img.displayUrl,
      thumbnailUrl: img.thumbnailUrl,
      originalFilename: img.originalFilename,
      // Story 35.4 / FR137: pass mediaType / durationSeconds / posterUrl
      // through to the lightbox so the Story 35.3 VIDEO branch fires.
      mediaType: img.mediaType,
      durationSeconds: img.durationSeconds,
      posterUrl: img.posterUrl,
      caption: {
        title: step.name,
        description: step.notes.map((note) => note.text).join(' ') || null,
      },
    })),
  )

  // Map (stepIndex, imageIndex) to flat index
  const getFlatIndex = useCallback(
    (stepIdx: number, imgIdx: number) => {
      let flat = 0
      for (let s = 0; s < stepIdx; s++) {
        flat += steps[s].images.length
      }
      return flat + imgIdx
    },
    [steps],
  )

  const openLightbox = useCallback(
    (stepIdx: number, imgIdx: number) => {
      setLightboxIndex(getFlatIndex(stepIdx, imgIdx))
    },
    [getFlatIndex],
  )

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
  }, [])

  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-lg text-muted-foreground">{project.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <HobbyIdentity hobby={project.hobby} variant="badge" />
          {project.totalHoursLabel && (
            <span className="text-sm text-muted-foreground" data-testid="gallery-total-hours">
              {project.totalHoursLabel} logged
            </span>
          )}
        </div>
      </header>

      {steps.map((step, stepIdx) => (
        <section key={stepIdx} className="space-y-4 pt-4 border-t border-border">
          <h2 className="text-xl font-semibold">{step.name}</h2>

          {step.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {step.images.map((img, imgIdx) => {
                const isVideo = img.mediaType === 'VIDEO'
                return (
                  <button
                    key={imgIdx}
                    type="button"
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-lg',
                      'cursor-pointer ring-ring transition-shadow',
                      'hover:ring-2 focus-visible:outline-none focus-visible:ring-2',
                    )}
                    onClick={() => openLightbox(stepIdx, imgIdx)}
                    aria-label={`View ${img.originalFilename ?? `${step.name} image ${imgIdx + 1}`}`}
                  >
                    {/* Story 35.4 / FR137: VIDEO tiles render poster
                        (Cloudinary so_auto) + play overlay, or generic
                        play-icon card (S3 null poster). NO `<video>` at
                        tile size. Open/close morph is gated off for
                        video per Story 35.3's layoutId discipline —
                        videos open via Reveal primitive instead. */}
                    {isVideo ? (
                      <div className="relative h-full w-full bg-muted">
                        {img.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img.posterUrl}
                            alt={img.originalFilename ?? `${step.name} video ${imgIdx + 1}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted">
                            <Play className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <div
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          data-testid="video-play-overlay"
                        >
                          <div className="rounded-full bg-black/60 p-3">
                            <Play className="h-8 w-8 fill-white text-white" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Story 32.3: layoutId matches the lightbox's
                      // per-image fallback (`lightbox-{img.id}`) so the
                      // open/close morph plays. The synthetic id pattern
                      // `journey-{stepIdx}-{imgIdx}` is stable per page
                      // render.
                      <motion.img
                        layoutId={`lightbox-journey-${stepIdx}-${imgIdx}`}
                        transition={tokens.transitions.layout}
                        src={img.thumbnailUrl || img.displayUrl}
                        alt={img.originalFilename ?? `${step.name} image ${imgIdx + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {step.notes.length > 0 && (
            <div className="space-y-2">
              {step.notes.map((note, i) => (
                <p key={i} className="text-sm text-muted-foreground whitespace-pre-line">
                  {note.text}
                </p>
              ))}
            </div>
          )}
        </section>
      ))}

      {steps.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No steps to display.</p>
      )}

      <AnimatePresence>
        {lightboxIndex !== null && (
          <ImageLightbox
            images={allImages}
            initialIndex={lightboxIndex}
            onClose={closeLightbox}
            showDelete={false}
          />
        )}
      </AnimatePresence>
    </article>
  )
}
