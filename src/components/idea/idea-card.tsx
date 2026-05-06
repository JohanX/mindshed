'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { IdeaWithThumbnail } from '@/actions/idea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IdeaActionsMenu } from '@/components/idea/idea-actions-menu'
import { ImageLightbox } from '@/components/image/image-lightbox'
import type { GalleryImage } from '@/components/image/image-gallery'
import { getIdeaImage } from '@/actions/idea-image'
import { showErrorToast } from '@/lib/toast'
import { formatReferenceUrl } from '@/lib/idea-utils'
import { hobbyColorWithAlpha, getReadableHobbyColor } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import { useMotionTokens } from '@/lib/motion/motion-tokens'
import { ExternalLink, Loader2 } from 'lucide-react'

export interface IdeaCardHobby {
  id: string
  name: string
  color: string
  icon: string | null
}

interface IdeaCardProps {
  idea: IdeaWithThumbnail
  hobby: IdeaCardHobby
  /** Show the hobby name badge. Default true; pass false on per-hobby pages where hobby is already in context. */
  showHobbyBadge?: boolean
}

export function IdeaCard({ idea, hobby, showHobbyBadge = true }: IdeaCardProps) {
  // FR107: darkened-if-light hobby color so watermark stays visible.
  const watermarkIcon = renderHobbyIcon(hobby.icon, {
    className: 'h-10 w-10 watermark-icon',
    style: { color: getReadableHobbyColor(hobby.color) },
  })

  const tokens = useMotionTokens()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<GalleryImage[]>([])
  const [lightboxLoading, setLightboxLoading] = useState(false)
  // Story 32.3: matches the lightbox's `morphLayoutId` for the open
  // morph; stable per idea entity.
  const morphLayoutId = `idea-thumb-${idea.id}`

  async function openLightbox() {
    setLightboxOpen(true)
    setLightboxLoading(true)
    const result = await getIdeaImage(idea.id)
    if (result.success) {
      if (!result.data.image) {
        setLightboxOpen(false)
        setLightboxLoading(false)
        return
      }
      const img = result.data.image
      setLightboxImages([
        {
          id: img.id,
          displayUrl: img.displayUrl,
          thumbnailUrl: img.thumbnailUrl,
          originalFilename: img.originalFilename,
        },
      ])
    } else {
      showErrorToast(result.error)
      setLightboxOpen(false)
    }
    setLightboxLoading(false)
  }

  return (
    <>
      <Card
        data-testid="idea-card"
        className={`relative overflow-hidden ${idea.isPromoted ? 'opacity-60' : ''}`}
        style={{ backgroundColor: hobbyColorWithAlpha(hobby.color) }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            {idea.thumbnailUrl && (
              <button
                type="button"
                className="h-12 w-12 shrink-0 overflow-hidden rounded-md min-h-[44px] min-w-[44px] cursor-pointer ring-ring transition-shadow hover:ring-2 focus-visible:outline-none focus-visible:ring-2"
                onClick={() => void openLightbox()}
                aria-label={`View photo of ${idea.title}`}
              >
                {/* Story 32.3: layoutId matches lightbox morphLayoutId. */}
                <motion.img
                  layoutId={morphLayoutId}
                  transition={tokens.transitions.layout}
                  src={idea.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <CardTitle className="text-base">{idea.title}</CardTitle>
              {(showHobbyBadge ||
                (idea.referenceLink && /^https?:\/\//.test(idea.referenceLink))) && (
                <div className="flex flex-wrap items-center gap-2">
                  {showHobbyBadge && (
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: hobby.color, color: hobby.color }}
                    >
                      {hobby.name}
                    </Badge>
                  )}
                  {idea.referenceLink && /^https?:\/\//.test(idea.referenceLink) && (
                    <a
                      href={idea.referenceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      aria-label={`Open reference link for ${idea.title}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{formatReferenceUrl(idea.referenceLink)}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
            <IdeaActionsMenu idea={idea} />
          </div>
        </CardHeader>
        {idea.description && (
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-3">{idea.description}</p>
          </CardContent>
        )}
        {watermarkIcon && (
          <div className="absolute bottom-2 right-2 z-10 pointer-events-none" aria-hidden="true">
            {watermarkIcon}
          </div>
        )}
      </Card>

      {lightboxOpen && lightboxLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
      <AnimatePresence>
        {lightboxOpen && !lightboxLoading && lightboxImages.length > 0 && (
          <ImageLightbox
            images={lightboxImages}
            initialIndex={0}
            onClose={() => setLightboxOpen(false)}
            showDelete={false}
            morphLayoutId={morphLayoutId}
          />
        )}
      </AnimatePresence>
    </>
  )
}
