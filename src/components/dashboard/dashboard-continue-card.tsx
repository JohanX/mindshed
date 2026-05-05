import { ProjectCard } from '@/components/project/project-card'
import { resolveProjectThumbnailUrl } from '@/lib/project-photos'
import type { RecentProject } from '@/lib/schemas/dashboard'

export interface DashboardContinueCardProps {
  project: RecentProject
}

export function DashboardContinueCard({ project }: DashboardContinueCardProps) {
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
        totalHoursLogged: project.totalHoursLogged,
      }}
      hobby={project.hobby}
      showHobbyBadge
    />
  )
}
