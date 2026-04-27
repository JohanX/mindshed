export const dynamic = 'force-dynamic'

import { getAllIdeas } from '@/actions/idea'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { IdeaFormDialog } from '@/components/idea/idea-form'
import { IdeaActionsMenu } from '@/components/idea/idea-actions-menu'
import { EmptyStateCard } from '@/components/empty-state-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import { formatReferenceUrl } from '@/lib/idea-utils'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'

export default async function IdeasPage() {
  const hobbies = await prisma.hobby.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, color: true },
  })

  const result = await getAllIdeas()
  const ideas = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <PageHeader title="Ideas" breadcrumbs={[{ label: 'Ideas' }]}>
        <IdeaFormDialog hobbies={hobbies} />
      </PageHeader>

      {ideas.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => {
            const watermarkIcon = renderHobbyIcon(idea.hobby.icon, {
              className: 'h-10 w-10 watermark-icon',
              style: { color: idea.hobby.color },
            })
            return (
              <Card
                key={idea.id}
                data-testid="idea-card"
                className={`relative overflow-hidden ${idea.isPromoted ? 'opacity-60' : ''}`}
                style={{ backgroundColor: hobbyColorWithAlpha(idea.hobby.color) }}
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
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: idea.hobby.color, color: idea.hobby.color }}
                      >
                        {idea.hobby.name}
                      </Badge>
                      <IdeaActionsMenu idea={idea} />
                    </div>
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
          })}
        </div>
      ) : (
        <EmptyStateCard message="No ideas yet. Capture your next spark!">
          <IdeaFormDialog hobbies={hobbies} />
        </EmptyStateCard>
      )}
    </div>
  )
}
