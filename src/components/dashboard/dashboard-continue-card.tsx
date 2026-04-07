import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import type { RecentProject } from '@/lib/schemas/dashboard'
import { getPublicUrl } from '@/lib/r2'

export interface DashboardContinueCardProps {
  project: RecentProject
  variant: 'primary' | 'secondary'
}

function resolvePhotoUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null
  try {
    return getPublicUrl(storageKey)
  } catch {
    return null
  }
}

export function DashboardContinueCard({ project, variant }: DashboardContinueCardProps) {
  const photoUrl = resolvePhotoUrl(project.latestPhoto?.storageKey)

  if (variant === 'secondary') {
    return (
      <Link
        href={`/hobbies/${project.hobbyId}/projects/${project.id}`}
        className="block min-h-[44px]"
      >
        <Card size="sm" className="transition-colors hover:bg-accent/50">
          <CardContent className="flex items-center gap-3">
            <HobbyIdentity hobby={project.hobby} variant="dot" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{project.name}</p>
              {project.currentStep && (
                <p className="text-xs text-muted-foreground truncate">
                  {project.currentStep.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <Link
      href={`/hobbies/${project.hobbyId}/projects/${project.id}`}
      className="block min-h-[44px]"
    >
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-start gap-4">
          {photoUrl && (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={photoUrl}
                alt={`Latest photo for ${project.name}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-base font-medium truncate">{project.name}</p>
            <HobbyIdentity hobby={project.hobby} variant="badge" />
            {project.currentStep && (
              <p className="text-sm text-muted-foreground truncate">
                {project.currentStep.name}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
