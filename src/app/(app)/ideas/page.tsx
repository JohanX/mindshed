export const dynamic = 'force-dynamic'

import { getAllIdeas } from '@/actions/idea'
import { findAllHobbiesOrdered } from '@/data/hobby'
import { PageHeader } from '@/components/layout/page-header'
import { IdeaFormDialog } from '@/components/idea/idea-form'
import { IdeaCard } from '@/components/idea/idea-card'
import { EmptyStateCard } from '@/components/empty-state-card'

export default async function IdeasPage() {
  const hobbies = await findAllHobbiesOrdered()

  const result = await getAllIdeas()
  const ideas = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <PageHeader title="Ideas" breadcrumbs={[{ label: 'Ideas' }]}>
        <IdeaFormDialog hobbies={hobbies} />
      </PageHeader>

      {ideas.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} hobby={idea.hobby} showHobbyBadge={true} />
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
