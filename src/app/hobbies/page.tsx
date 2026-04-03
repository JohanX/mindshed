import { PageHeader } from '@/components/layout/page-header'
import { HobbyFormDialog } from '@/components/hobby/hobby-form'

export default function HobbiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hobbies"
        breadcrumbs={[{ label: 'Hobbies' }]}
      >
        <HobbyFormDialog />
      </PageHeader>
      {/* Hobby list will be added in Story 2.2 */}
    </div>
  )
}
