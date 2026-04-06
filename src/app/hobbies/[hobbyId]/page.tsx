import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getProjectsByHobby } from '@/actions/project'
import { PageHeader } from '@/components/layout/page-header'
import { ProjectCreateDialog } from '@/components/project/project-create-dialog'
import { ProjectList } from '@/components/project/project-list'
import { EmptyStateCard } from '@/components/empty-state-card'

interface HobbyDetailPageProps {
  params: Promise<{ hobbyId: string }>
}

export default async function HobbyDetailPage({ params }: HobbyDetailPageProps) {
  const { hobbyId } = await params
  const hobby = await prisma.hobby.findUnique({
    where: { id: hobbyId },
    select: { id: true, name: true, color: true, icon: true },
  })

  if (!hobby) notFound()

  const result = await getProjectsByHobby(hobbyId)
  const projects = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <PageHeader
        title={hobby.name}
        breadcrumbs={[
          { label: 'Hobbies', href: '/hobbies' },
          { label: hobby.name },
        ]}
      >
        <ProjectCreateDialog hobbyId={hobbyId} />
      </PageHeader>

      {projects.length > 0 ? (
        <ProjectList
          projects={projects}
          hobby={{ name: hobby.name, color: hobby.color, icon: hobby.icon }}
        />
      ) : (
        <EmptyStateCard message={`No projects yet in ${hobby.name}. Start one!`}>
          <ProjectCreateDialog hobbyId={hobbyId} />
        </EmptyStateCard>
      )}
    </div>
  )
}
