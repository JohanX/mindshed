import Link from 'next/link'
import { notFound } from 'next/navigation'
import { findHobbyHeader } from '@/data/hobby'
import { getProjectsByHobby } from '@/actions/project'
import { PageHeader } from '@/components/layout/page-header'
import { ProjectCreateDialog } from '@/components/project/project-create-dialog'
import { ProjectList } from '@/components/project/project-list'
import { EmptyStateCard } from '@/components/empty-state-card'
import { Button } from '@/components/ui/button'
import { Lightbulb } from 'lucide-react'

interface HobbyDetailPageProps {
  params: Promise<{ hobbyId: string }>
}

export default async function HobbyDetailPage({ params }: HobbyDetailPageProps) {
  const { hobbyId } = await params
  const hobby = await findHobbyHeader(hobbyId)

  if (!hobby) notFound()

  const result = await getProjectsByHobby(hobbyId)
  const projects = result.success ? result.data : []

  return (
    <div className="space-y-6">
      <PageHeader
        title={hobby.name}
        breadcrumbs={[
          { label: 'Hobbies', href: '/hobbies' },
          { label: hobby.name, hobbyColor: hobby.color },
        ]}
      >
        <div className="flex items-center gap-2">
          <Link href={`/hobbies/${hobbyId}/ideas`}>
            <Button variant="outline" size="sm" className="min-h-[44px]">
              <Lightbulb className="h-4 w-4 mr-1" />
              Ideas
            </Button>
          </Link>
          <ProjectCreateDialog hobbyId={hobbyId} />
        </div>
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
