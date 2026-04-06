import type { Idea } from '@/generated/prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink } from 'lucide-react'

interface IdeaListProps {
  ideas: Idea[]
  hobbyId: string
}

export function IdeaList({ ideas }: IdeaListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ideas.map((idea) => (
        <Card key={idea.id} data-testid="idea-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {idea.title}
              {idea.referenceLink && (
                <a
                  href={idea.referenceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </CardTitle>
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
  )
}
