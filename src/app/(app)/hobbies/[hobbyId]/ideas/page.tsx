import { notFound } from 'next/navigation'
import { findHobbyHeader } from '@/data/hobby'
import { getIdeasByHobby } from '@/actions/idea'
import { PageHeader } from '@/components/layout/page-header'
import { IdeaFormDialog } from '@/components/idea/idea-form'
import { IdeaList } from '@/components/idea/idea-list'
import { EmptyStateCard } from '@/components/empty-state-card'

interface HobbyIdeasPageProps {
  params: Promise<{ hobbyId: string }>
}

export default async function HobbyIdeasPage({ params }: HobbyIdeasPageProps) {
  const { hobbyId } = await params
  const hobby = await findHobbyHeader(hobbyId)

  if (!hobby) notFound()

  const result = await getIdeasByHobby(hobbyId)
  const ideas = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${hobby.name} Ideas`}
        breadcrumbs={[
          { label: 'Hobbies', href: '/hobbies' },
          { label: hobby.name, href: `/hobbies/${hobbyId}`, hobbyColor: hobby.color },
          { label: 'Ideas' },
        ]}
      >
        <IdeaFormDialog hobbyId={hobbyId} />
      </PageHeader>

      {ideas.length > 0 ? (
        <IdeaList ideas={ideas} hobby={hobby} />
      ) : (
        <EmptyStateCard message="No ideas captured yet. When inspiration strikes, add it here.">
          <IdeaFormDialog hobbyId={hobbyId} />
        </EmptyStateCard>
      )}
    </div>
  )
}
