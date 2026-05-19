import Link from 'next/link'
import { Play } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProjectStatusBadge } from '@/components/project/project-status-badge'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { hobbyColorWithAlpha, getReadableHobbyColor } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import { formatHours } from '@/lib/hours-format'
import type { DerivedProjectStatus } from '@/lib/project-status'

export interface ProjectCardData {
  id: string
  name: string
  hobbyId: string
  totalSteps: number
  completedSteps: number
  derivedStatus: DerivedProjectStatus
  currentStepName: string | null
  /** Pre-resolved latest-photo info (server-rendered) so this component can
   * stay importable from client components without dragging in the image-
   * storage adapter and its native deps.
   *
   * Story 35.6 / FR139 — `{ url, mediaType }` struct so the card can render
   * the VIDEO branches (poster + Play overlay for Cloudinary, generic play-
   * icon card for S3 null-poster). Single canonical shape — code-review
   * patch dropped the legacy `latestPhotoUrl` dual-shape API after verifying
   * zero in-tree callers used it. */
  latestPhoto?: {
    url: string | null
    mediaType: 'IMAGE' | 'VIDEO'
  } | null
  /** Story 30.5 / FR129 — sum of step.hoursLogged across the project, or
   * null when the parent hobby has tracking disabled. The server-rendered
   * card hides this field via `formatHours` (also returns null for 0). */
  totalHoursLogged?: number | null
}

interface ProjectCardProps {
  project: ProjectCardData
  hobby?: { name: string; color: string; icon: string | null }
  showHobbyBadge?: boolean
}

export function ProjectCard({ project, hobby, showHobbyBadge }: ProjectCardProps) {
  // FR107: darkened-if-light hobby color so the watermark icon stays visible
  // against the default card background even with pale hobby colors.
  const watermarkIcon = hobby
    ? renderHobbyIcon(hobby.icon, {
        className: 'h-10 w-10 watermark-icon',
        style: { color: getReadableHobbyColor(hobby.color) },
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
          {/* Story 35.6 / FR139 — render the latest-photo thumbnail with
              mediaType awareness. VIDEO branch overlays a Play icon so
              the visual signal matches every other tile surface; S3
              null-poster falls through to a generic play-icon card so
              the user never sees a broken `<img>`. NO `<video>` element
              renders at thumbnail size on any surface — FR136/FR137/FR139
              hard rule.

              Accessibility note: the `<Link>` wrapping this card already
              carries the project name as its accessible name, so the
              inner thumbnail uses `alt=""` (decorative) to avoid screen-
              reader double-announce (code-review MED-2). `loading="lazy"`
              defers off-screen thumbnail fetches on the `/projects` list
              + hobby detail surfaces where N project cards can stack
              (code-review MED-3). */}
          {(() => {
            const photoUrl = project.latestPhoto?.url ?? null
            const mediaType = project.latestPhoto?.mediaType ?? 'IMAGE'
            if (mediaType === 'VIDEO') {
              if (photoUrl) {
                return (
                  <div
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg"
                    data-testid="project-card-video-poster"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      data-testid="video-play-overlay"
                    >
                      <div className="rounded-full bg-black/60 p-1.5">
                        <Play className="h-4 w-4 fill-white text-white" />
                      </div>
                    </div>
                  </div>
                )
              }
              // S3 null-poster: generic play-icon card. No broken <img>.
              return (
                <div
                  className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted"
                  data-testid="project-card-video-placeholder"
                  aria-hidden="true"
                >
                  <Play className="h-6 w-6 text-muted-foreground" />
                </div>
              )
            }
            if (photoUrl) {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              )
            }
            return null
          })()}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-medium truncate">{project.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {project.completedSteps}/{project.totalSteps} steps
                {formatHours(project.totalHoursLogged) && (
                  <> · {formatHours(project.totalHoursLogged)}</>
                )}
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
