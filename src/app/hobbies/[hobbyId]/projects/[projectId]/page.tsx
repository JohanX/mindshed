import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { ProjectActions } from '@/components/project/project-actions'
import { type StepCardData } from '@/components/step/step-card'
import { StepCardList } from '@/components/step/step-card-list'
import { StepList } from '@/components/project/step-list'
import { EmptyStateCard } from '@/components/empty-state-card'
import type { StepState } from '@/lib/step-states'

interface ProjectDetailPageProps {
  params: Promise<{ hobbyId: string; projectId: string }>
}

function getPublicImageUrl(storageKey: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL
  const bucket = process.env.R2_BUCKET_NAME
  if (publicUrl && bucket) return `${publicUrl}/${bucket}/${storageKey}`
  const endpoint = process.env.R2_ENDPOINT
  if (!endpoint || !bucket) return ''
  return `${endpoint}/${bucket}/${storageKey}`
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { hobbyId, projectId } = await params
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      hobby: true,
      steps: {
        orderBy: { sortOrder: 'asc' },
        include: {
          notes: { orderBy: { createdAt: 'desc' } },
          images: { orderBy: { createdAt: 'desc' } },
          blockers: { where: { isResolved: false }, orderBy: { createdAt: 'desc' } },
        },
      },
    },
  })

  if (!project || project.hobbyId !== hobbyId) notFound()

  // Compute current step (first IN_PROGRESS or NOT_STARTED)
  const currentStepId = project.steps.find(s => s.state === 'IN_PROGRESS')?.id
    ?? project.steps.find(s => s.state === 'NOT_STARTED')?.id
    ?? null

  // Map steps with nested data for StepCard
  const stepCards: StepCardData[] = project.steps.map(s => ({
    id: s.id,
    name: s.name,
    state: s.state as StepState,
    sortOrder: s.sortOrder,
    notes: s.notes.map(n => ({ id: n.id, text: n.text, createdAt: n.createdAt })),
    images: s.images.map(img => ({
      id: img.id,
      displayUrl: img.type === 'UPLOAD' && img.storageKey
        ? getPublicImageUrl(img.storageKey)
        : img.url ?? '',
      originalFilename: img.originalFilename,
    })),
    blockers: s.blockers.map(b => ({ id: b.id, description: b.description })),
  }))

  // Flat step data for StepList (add/reorder functionality)
  const flatSteps = project.steps.map(s => ({
    id: s.id,
    name: s.name,
    state: s.state as StepState,
    sortOrder: s.sortOrder,
  }))

  const stepKey = stepCards.map(s => `${s.id}:${s.state}:${s.notes.length}:${s.images.length}:${s.blockers.length}`).join(',')

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

      {stepCards.length > 0 ? (
        <StepCardList
          key={stepKey}
          initialSteps={stepCards}
          currentStepId={currentStepId}
          isProjectCompleted={project.isCompleted}
          projectId={project.id}
        />
      ) : null}

      {!project.isCompleted && (
        <StepList
          key={flatSteps.map(s => s.id).join(',')}
          steps={flatSteps}
          projectId={project.id}
          isCompleted={project.isCompleted}
          hideStepDisplay
        />
      )}

      {stepCards.length === 0 && project.isCompleted && (
        <EmptyStateCard message="Add steps to track your progress." />
      )}
    </div>
  )
}
