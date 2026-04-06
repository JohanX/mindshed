import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { StepStateBadge } from '@/components/step-state-badge'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import type { StepState } from '@/lib/step-states'

export interface ProjectCardData {
  id: string
  name: string
  hobbyId: string
  totalSteps: number
  completedSteps: number
  currentStepName: string | null
  currentStepState: StepState | null
  hasBlockedSteps: boolean
}

interface ProjectCardProps {
  project: ProjectCardData
  hobby?: { name: string; color: string; icon: string | null }
  showHobbyBadge?: boolean
}

export function ProjectCard({ project, hobby, showHobbyBadge }: ProjectCardProps) {
  return (
    <Link href={`/hobbies/${project.hobbyId}/projects/${project.id}`} className="block">
      {hobby ? (
        <HobbyIdentity hobby={hobby} variant="accent">
          <Card className="border-0 ring-0 rounded-none min-h-[44px]">
            <CardContent className="space-y-2">
              <ProjectCardContent project={project} hobby={hobby} showHobbyBadge={showHobbyBadge} />
            </CardContent>
          </Card>
        </HobbyIdentity>
      ) : (
        <Card className="min-h-[44px]">
          <CardContent className="space-y-2">
            <ProjectCardContent project={project} showHobbyBadge={false} />
          </CardContent>
        </Card>
      )}
    </Link>
  )
}

function ProjectCardContent({
  project,
  hobby,
  showHobbyBadge,
}: {
  project: ProjectCardData
  hobby?: { name: string; color: string; icon: string | null }
  showHobbyBadge?: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-lg font-medium">{project.name}</span>
        <span className="text-xs text-muted-foreground">
          {project.completedSteps}/{project.totalSteps} steps
        </span>
      </div>
      {project.currentStepName && project.currentStepState && (
        <div className="flex items-center gap-2">
          <StepStateBadge state={project.currentStepState} size="sm" />
          <span className="text-sm text-muted-foreground truncate">{project.currentStepName}</span>
        </div>
      )}
      {showHobbyBadge && hobby && (
        <HobbyIdentity hobby={hobby} variant="badge" />
      )}
    </>
  )
}
