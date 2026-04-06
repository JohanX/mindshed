import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { ProjectCreateDialog } from '@/components/project/project-create-dialog'
import { ProjectCard, type ProjectCardData } from '@/components/project/project-card'
import { EmptyStateCard } from '@/components/empty-state-card'
import { STEP_STATE_CONFIG, type StepState } from '@/lib/step-states'

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

  const projects: ProjectCardData[] = hobby.projects.map((project) => {
    const currentStep = project.steps.find(s => s.state === 'IN_PROGRESS') ??
      project.steps.find(s => s.state === 'NOT_STARTED')

    return {
      id: project.id,
      name: project.name,
      hobbyId: project.hobbyId,
      totalSteps: project.steps.length,
      completedSteps: project.steps.filter(s => s.state === 'COMPLETED').length,
      currentStepName: currentStep?.name ?? null,
      currentStepState: currentStep?.state && currentStep.state in STEP_STATE_CONFIG
        ? (currentStep.state as StepState) : null,
      hasBlockedSteps: project.steps.some(s => s.state === 'BLOCKED'),
    }
  })

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
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} hobby={{ name: hobby.name, color: hobby.color, icon: hobby.icon }} />
          ))}
        </div>
      ) : (
        <EmptyStateCard message={`No projects yet in ${hobby.name}. Start one!`}>
          <ProjectCreateDialog hobbyId={hobbyId} />
        </EmptyStateCard>
      )}
    </div>
  )
}
