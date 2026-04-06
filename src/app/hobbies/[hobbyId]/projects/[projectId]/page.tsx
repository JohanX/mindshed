import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { StepStateBadge } from '@/components/step-state-badge'
import { Card, CardContent } from '@/components/ui/card'

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        breadcrumbs={[
          { label: 'Hobbies', href: '/hobbies' },
          { label: project.hobby.name, href: `/hobbies/${hobbyId}` },
          { label: project.name },
        ]}
      />

      {project.description && (
        <p className="text-muted-foreground">{project.description}</p>
      )}

      <div className="space-y-3">
        {project.steps.map((step) => (
          <Card key={step.id}>
            <CardContent className="flex items-center justify-between">
              <span className="font-medium">{step.name}</span>
              <StepStateBadge state={step.state} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
