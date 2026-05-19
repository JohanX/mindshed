import { ProjectCard } from '@/components/project/project-card'
import { resolveProjectThumbnailUrl } from '@/data/project-photos'
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
        // Story 35.6 / FR139 — pass the new `latestPhoto` struct so the
        // card can branch on VIDEO. The URL is resolved here (server-
        // side); `mediaType` flows through from `LatestProjectPhoto`.
        latestPhoto: {
          url: resolveProjectThumbnailUrl(project.latestPhoto),
          mediaType: project.latestPhoto?.mediaType ?? 'IMAGE',
        },
        totalHoursLogged: project.totalHoursLogged,
      }}
      hobby={project.hobby}
      showHobbyBadge
    />
  )
}
