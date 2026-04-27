'use client'

import type { IdeaWithThumbnail } from '@/actions/idea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IdeaActionsMenu } from '@/components/idea/idea-actions-menu'
import { formatReferenceUrl } from '@/lib/idea-utils'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import { ExternalLink } from 'lucide-react'

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
  const watermarkIcon = renderHobbyIcon(hobby.icon, {
    className: 'h-10 w-10 watermark-icon',
    style: { color: hobby.color },
  })

  return (
    <Card
      data-testid="idea-card"
      className={`relative overflow-hidden ${idea.isPromoted ? 'opacity-60' : ''}`}
      style={{ backgroundColor: hobbyColorWithAlpha(hobby.color) }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          {idea.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={idea.thumbnailUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-md object-cover"
            />
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
        <div
          className="absolute bottom-2 right-2 z-10 pointer-events-none"
          aria-hidden="true"
        >
          {watermarkIcon}
        </div>
      )}
    </Card>
  )
}
