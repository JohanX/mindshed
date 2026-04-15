import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import type { RecentProject } from '@/lib/schemas/dashboard'
import { getImageStorageAdapter } from '@/lib/image-storage/adapter'

export interface DashboardContinueCardProps {
  project: RecentProject
  variant: 'primary' | 'secondary'
}

function resolvePhotoUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null
  try {
    const adapter = getImageStorageAdapter()
    if (!adapter) return null
    return adapter.getPublicUrl(storageKey)
  } catch {
    return null
  }
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
  const photoUrl = resolvePhotoUrl(project.latestPhoto?.storageKey)

  if (variant === 'secondary') {
    return (
      <Link
        href={`/hobbies/${project.hobbyId}/projects/${project.id}`}
        className="block min-h-[44px]"
      >
        <Card
          size="sm"
          className="relative overflow-hidden transition-opacity hover:opacity-90"
          style={{ backgroundColor: hobbyColorWithAlpha(project.hobby.color, 0.12) }}
        >
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
          <HobbyWatermark hobby={project.hobby} />
        </Card>
      </Link>
    )
  }

  return (
    <Link
      href={`/hobbies/${project.hobbyId}/projects/${project.id}`}
      className="block min-h-[44px]"
    >
      <Card
        className="relative overflow-hidden transition-opacity hover:opacity-90"
        style={{ backgroundColor: hobbyColorWithAlpha(project.hobby.color, 0.12) }}
      >
        <CardContent className="flex items-start gap-4">
          {photoUrl && (
            <img
              src={photoUrl}
              alt={`Latest photo for ${project.name}`}
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
              loading="lazy"
            />
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
        <HobbyWatermark hobby={project.hobby} />
      </Card>
    </Link>
  )
}
