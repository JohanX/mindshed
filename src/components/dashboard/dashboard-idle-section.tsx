import Link from 'next/link'
import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { HobbyIdentity } from '@/components/hobby/hobby-identity'
import { hobbyColorWithAlpha } from '@/lib/hobby-color'
import { renderHobbyIcon } from '@/lib/hobby-icons'
import { formatRelativeTime } from '@/lib/format-date'
import type { IdleProject } from '@/lib/schemas/dashboard'

interface DashboardIdleSectionProps {
  projects: IdleProject[]
}

export function DashboardIdleSection({ projects }: DashboardIdleSectionProps) {
  if (projects.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold border-b border-primary/20 pb-2">
          <Clock className="h-5 w-5 text-primary" />
          Idle Projects
        </h2>
        <p className="text-muted-foreground py-4">
          No idle projects — everything is moving along!
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Idle Projects</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map((p) => {
          const watermarkIcon = renderHobbyIcon(p.hobby.icon, {
            className: 'h-10 w-10 watermark-icon',
            style: { color: p.hobby.color },
          })
          return (
            <Link
              key={p.id}
              href={`/hobbies/${p.hobbyId}/projects/${p.id}`}
              className="block min-h-[44px]"
            >
              <Card
                size="sm"
                className="relative overflow-hidden transition-opacity hover:opacity-90"
                style={{ backgroundColor: hobbyColorWithAlpha(p.hobby.color, 0.12) }}
              >
                <CardContent className="space-y-1">
                  <div className="flex items-center gap-2">
                    <HobbyIdentity hobby={p.hobby} variant="dot" />
                    <p className="text-sm font-medium truncate">{p.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last activity: {formatRelativeTime(p.lastActivityAt)}
                  </p>
                </CardContent>
                {watermarkIcon && (
                  <div className="absolute bottom-2 right-2 z-10 pointer-events-none" aria-hidden="true">
                    {watermarkIcon}
                  </div>
                )}
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
