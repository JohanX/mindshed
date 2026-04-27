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
  /** Pre-resolved thumbnail URL (server-rendered) so this component can stay
   * importable from client components without dragging in the image-storage
   * adapter and its native deps. */
  latestPhotoUrl?: string | null
}

interface ProjectCardProps {
  project: ProjectCardData
  hobby?: { name: string; color: string; icon: string | null }
  showHobbyBadge?: boolean
}

export function ProjectCard({ project, hobby, showHobbyBadge }: ProjectCardProps) {
  const watermarkIcon = hobby
    ? renderHobbyIcon(hobby.icon, {
        className: 'h-10 w-10 watermark-icon',
        style: { color: hobby.color },
      })
    : null

  return (
    <Link
      href={`/hobbies/${project.hobbyId}/projects/${project.id}`}
      className="block min-h-[44px]"
    >
      <Card
        className="relative overflow-hidden min-h-[44px]"
        style={hobby ? { backgroundColor: hobbyColorWithAlpha(hobby.color) } : undefined}
      >
        <CardContent className="flex items-start gap-3">
          {project.latestPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.latestPhotoUrl}
              alt={`Latest photo for ${project.name}`}
              width={64}
              height={64}
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-medium truncate">{project.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {project.completedSteps}/{project.totalSteps} steps
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ProjectStatusBadge status={project.derivedStatus} size="sm" />
              {project.currentStepName && (
                <span className="text-sm text-muted-foreground truncate">
                  {project.currentStepName}
                </span>
              )}
            </div>
            {showHobbyBadge && hobby && <HobbyIdentity hobby={hobby} variant="badge" />}
          </div>
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
