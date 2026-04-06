import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { ProjectCreateDialog } from '@/components/project/project-create-dialog'
import { EmptyStateCard } from '@/components/empty-state-card'
import { Card, CardContent } from '@/components/ui/card'
import { StepStateBadge } from '@/components/step-state-badge'
import Link from 'next/link'

interface HobbyDetailPageProps {
  params: Promise<{ hobbyId: string }>
}

export default async function HobbyDetailPage({ params }: HobbyDetailPageProps) {
  const { hobbyId } = await params
  const hobby = await prisma.hobby.findUnique({
    where: { id: hobbyId },
    include: {
      projects: {
        where: { isArchived: false },
        orderBy: { lastActivityAt: 'desc' },
        include: {
          steps: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  })

  if (!hobby) notFound()

  const projects = hobby.projects

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const totalSteps = project.steps.length
            const completedSteps = project.steps.filter(s => s.state === 'COMPLETED').length
            const currentStep = project.steps.find(s => s.state === 'IN_PROGRESS') ??
              project.steps.find(s => s.state === 'NOT_STARTED')

            return (
              <Link key={project.id} href={`/hobbies/${hobbyId}/projects/${project.id}`} className="block">
                <Card className="min-h-[44px]">
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium">{project.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {completedSteps}/{totalSteps} steps
                      </span>
                    </div>
                    {currentStep && (
                      <div className="flex items-center gap-2">
                        <StepStateBadge state={currentStep.state} size="sm" />
                        <span className="text-sm text-muted-foreground truncate">{currentStep.name}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <EmptyStateCard message={`No projects yet in ${hobby.name}. Start one!`}>
          <ProjectCreateDialog hobbyId={hobbyId} />
        </EmptyStateCard>
      )}
    </div>
  )
}
