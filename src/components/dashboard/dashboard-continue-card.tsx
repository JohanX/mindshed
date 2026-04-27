import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { ProjectCard } from '@/components/project/project-card'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import { resolveProjectThumbnailUrl } from '@/lib/project-photos'
import type { RecentProject } from '@/lib/schemas/dashboard'

export interface DashboardContinueCardProps {
  project: RecentProject
  variant: 'primary' | 'secondary'
}

function HobbyWatermark({ hobby }: { hobby: { icon: string | null; color: string } }) {
  const icon = renderHobbyIcon(hobby.icon, {
    className: 'h-10 w-10 watermark-icon',
    style: { color: hobby.color },
  })
  if (!icon) return null
  return (
    <div className="absolute bottom-2 right-2 z-10 pointer-events-none" aria-hidden="true">
      {icon}
    </div>
  )
}

export function DashboardContinueCard({ project, variant }: DashboardContinueCardProps) {
  if (variant === 'secondary') {
    return (
      <Link
        href={`/hobbies/${project.hobbyId}/projects/${project.id}`}
        className="block min-h-[44px]"
      >
        <Card
          size="sm"
          className="relative overflow-hidden transition-opacity hover:opacity-90"
          style={{ backgroundColor: hobbyColorWithAlpha(project.hobby.color) }}
        >
          <CardContent className="flex items-center gap-3">
            <HobbyIdentity hobby={project.hobby} variant="dot" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{project.name}</p>
              {project.currentStep && (
                <p className="text-xs text-muted-foreground truncate">{project.currentStep.name}</p>
              )}
            </div>
          </CardContent>
          <HobbyWatermark hobby={project.hobby} />
        </Card>
      </Link>
    )
  }

  // Primary variant: delegate to the shared ProjectCard so the dashboard's
  // featured project looks identical to project cards on /projects and on
  // a hobby detail page (photo + name + step count + status badge + currentStep).
  return (
    <ProjectCard
      project={{
        id: project.id,
        name: project.name,
        hobbyId: project.hobbyId,
        totalSteps: project.totalSteps,
        completedSteps: project.completedSteps,
        derivedStatus: project.derivedStatus,
        currentStepName: project.currentStep?.name ?? null,
        latestPhotoUrl: resolveProjectThumbnailUrl(project.latestPhoto),
      }}
      hobby={project.hobby}
      showHobbyBadge
    />
  )
}
