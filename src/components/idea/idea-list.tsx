'use client'

import type { IdeaWithThumbnail } from '@/actions/idea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IdeaActionsMenu } from '@/components/idea/idea-actions-menu'
import { formatReferenceUrl } from '@/lib/idea-utils'
import { ExternalLink } from 'lucide-react'

interface IdeaListProps {
  ideas: IdeaWithThumbnail[]
}

export function IdeaList({ ideas }: IdeaListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ideas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} />
      ))}
    </div>
  )
}

function IdeaCard({ idea }: { idea: IdeaWithThumbnail }) {
  return (
    <Card data-testid="idea-card" className={idea.isPromoted ? 'opacity-60' : ''}>
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
          <IdeaActionsMenu idea={idea} />
        </div>
      </CardHeader>
      {idea.description && (
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-3">{idea.description}</p>
        </CardContent>
      )}
    </Card>
  )
}
