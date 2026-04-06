import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { ProjectActions } from '@/components/project/project-actions'
import { StepList } from '@/components/project/step-list'
import { EmptyStateCard } from '@/components/empty-state-card'
import type { StepState } from '@/lib/step-states'

interface ProjectDetailPageProps {
  params: Promise<{ hobbyId: string; projectId: string }>
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { hobbyId, projectId } = await params
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      hobby: true,
      steps: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!project || project.hobbyId !== hobbyId) notFound()

  const steps = project.steps.map(s => ({
    id: s.id,
    name: s.name,
    state: s.state as StepState,
    sortOrder: s.sortOrder,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        breadcrumbs={[
          { label: 'Hobbies', href: '/hobbies' },
          { label: project.hobby.name, href: `/hobbies/${hobbyId}` },
          { label: project.name },
        ]}
      >
        <ProjectActions project={{
          id: project.id,
          name: project.name,
          description: project.description,
          hobbyId: project.hobbyId,
        }} />
      </PageHeader>

      {project.description && (
        <p className="text-muted-foreground">{project.description}</p>
      )}

      {steps.length > 0 || !project.isCompleted ? (
        <StepList steps={steps} projectId={project.id} isCompleted={project.isCompleted} />
      ) : (
        <EmptyStateCard message="Add steps to track your progress." />
      )}
    </div>
  )
}
