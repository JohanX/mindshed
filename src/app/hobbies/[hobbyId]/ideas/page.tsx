import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getIdeasByHobby } from '@/actions/idea'
import { PageHeader } from '@/components/layout/page-header'
import { IdeaFormDialog } from '@/components/idea/idea-form'
import { EmptyStateCard } from '@/components/empty-state-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink } from 'lucide-react'

interface HobbyIdeasPageProps {
  params: Promise<{ hobbyId: string }>
}

export default async function HobbyIdeasPage({ params }: HobbyIdeasPageProps) {
  const { hobbyId } = await params
  const hobby = await prisma.hobby.findUnique({
    where: { id: hobbyId },
    select: { id: true, name: true, color: true, icon: true },
  })

  if (!hobby) notFound()

  const result = await getIdeasByHobby(hobbyId)
  const ideas = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${hobby.name} Ideas`}
        breadcrumbs={[
          { label: 'Hobbies', href: '/hobbies' },
          { label: hobby.name, href: `/hobbies/${hobbyId}` },
          { label: 'Ideas' },
        ]}
      >
        <IdeaFormDialog hobbyId={hobbyId} />
      </PageHeader>

      {ideas.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <Card key={idea.id}>
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
      ) : (
        <EmptyStateCard message="No ideas yet. Capture your next spark!">
          <IdeaFormDialog hobbyId={hobbyId} />
        </EmptyStateCard>
      )}
    </div>
  )
}
