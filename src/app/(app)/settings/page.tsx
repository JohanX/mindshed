import { PageHeader } from '@/components/layout/page-header'
import { HobbyFormDialog } from '@/components/hobby/hobby-form'
import { SortableHobbyList } from '@/components/hobby/sortable-hobby-list'
import { ThemeSelector } from '@/components/theme-selector'
import { EmptyStateCard } from '@/components/empty-state-card'
import { getHobbies } from '@/actions/hobby'

export default async function SettingsPage() {
  const result = await getHobbies()
  const hobbies = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        breadcrumbs={[{ label: 'Settings' }]}
      >
        <HobbyFormDialog />
      </PageHeader>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Theme</h2>
        <ThemeSelector />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Hobby Management</h2>
        {!result.success ? (
          <EmptyStateCard message="Failed to load hobbies. Please refresh." />
        ) : hobbies.length > 0 ? (
          <SortableHobbyList key={hobbies.map(h => h.id).join(',')} hobbies={hobbies} />
        ) : (
          <EmptyStateCard message="No hobbies yet. Add your first hobby to get started.">
            <HobbyFormDialog />
          </EmptyStateCard>
        )}
      </section>
    </div>
  )
}
