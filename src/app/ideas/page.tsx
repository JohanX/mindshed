export const dynamic = 'force-dynamic'

import { getAllIdeas } from '@/actions/idea'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { IdeaFormDialog } from '@/components/idea/idea-form'
import { EmptyStateCard } from '@/components/empty-state-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
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
      <PageHeader
        title="Ideas"
        breadcrumbs={[{ label: 'Ideas' }]}
      >
        <IdeaFormDialog hobbies={hobbies} />
      </PageHeader>

      {ideas.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <Card
              key={idea.id}
              className="border-l-4"
              style={{ borderLeftColor: idea.hobby.color, backgroundColor: hobbyColorWithAlpha(idea.hobby.color, 0.05) }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {idea.title}
                    {idea.referenceLink && /^https?:\/\//.test(idea.referenceLink) && (
                      <a
                        href={idea.referenceLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Open reference link for ${idea.title}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-xs"
                    style={{ borderColor: idea.hobby.color, color: idea.hobby.color }}
                  >
                    {idea.hobby.name}
                  </Badge>
                </div>
              </CardHeader>
              {idea.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {idea.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyStateCard message="No ideas yet. Capture your next spark!">
          <IdeaFormDialog hobbies={hobbies} />
        </EmptyStateCard>
      )}
    </div>
  )
}
