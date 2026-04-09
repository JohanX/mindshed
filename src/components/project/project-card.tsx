import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ProjectStatusBadge } from '@/components/project/project-status-badge'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import type { DerivedProjectStatus } from '@/lib/project-status'

export interface ProjectCardData {
  id: string
  name: string
  hobbyId: string
  totalSteps: number
  completedSteps: number
  derivedStatus: DerivedProjectStatus
  currentStepName: string | null
}

interface ProjectCardProps {
  project: ProjectCardData
  hobby?: { name: string; color: string; icon: string | null }
  showHobbyBadge?: boolean
}

export function ProjectCard({ project, hobby, showHobbyBadge }: ProjectCardProps) {
  const watermarkIcon = hobby ? renderHobbyIcon(hobby.icon, {
    className: 'h-10 w-10',
    style: { color: hobby.color, opacity: 0.08 },
  }) : null

  return (
    <Link href={`/hobbies/${project.hobbyId}/projects/${project.id}`} className="block">
      <Card
        className="relative overflow-hidden min-h-[44px]"
        style={hobby ? { backgroundColor: hobbyColorWithAlpha(hobby.color, 0.12) } : undefined}
      >
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium">{project.name}</span>
            <span className="text-xs text-muted-foreground">
              {project.completedSteps}/{project.totalSteps} steps
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ProjectStatusBadge status={project.derivedStatus} size="sm" />
            {project.currentStepName && (
              <span className="text-sm text-muted-foreground truncate">{project.currentStepName}</span>
            )}
          </div>
          {showHobbyBadge && hobby && (
            <HobbyIdentity hobby={hobby} variant="badge" />
          )}
        </CardContent>
        {watermarkIcon && (
          <div className="absolute bottom-2 right-2 z-10 pointer-events-none" aria-hidden="true">
            {watermarkIcon}
          </div>
        )}
      </Card>
    </Link>
  )
}
