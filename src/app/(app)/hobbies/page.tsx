import { PageHeader } from '@/components/layout/page-header'
import { HobbyFormDialog } from '@/components/hobby/hobby-form'
import { HobbyList } from '@/components/hobby/hobby-list'
import { EmptyStateCard } from '@/components/empty-state-card'
import { getHobbies } from '@/actions/hobby'

export default async function HobbiesPage() {
  const result = await getHobbies()

  return (
    <div className="space-y-6">
      <PageHeader title="Hobbies" breadcrumbs={[{ label: 'Hobbies' }]}>
        <HobbyFormDialog />
      </PageHeader>
      {!result.success ? (
        <EmptyStateCard message="Failed to load hobbies. Please refresh the page." />
      ) : result.data.length > 0 ? (
        <HobbyList hobbies={result.data} />
      ) : (
        <EmptyStateCard message="Welcome to MindShed! Add your first hobby to get started.">
          <HobbyFormDialog />
        </EmptyStateCard>
      )}
    </div>
  )
}
