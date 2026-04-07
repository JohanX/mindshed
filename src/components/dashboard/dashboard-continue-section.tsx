import type { RecentProject } from '@/lib/schemas/dashboard'
import { DashboardContinueCard } from './dashboard-continue-card'

interface DashboardContinueSectionProps {
  projects: RecentProject[]
}

export function DashboardContinueSection({ projects }: DashboardContinueSectionProps) {
  if (projects.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Continue</h2>
        <p className="text-muted-foreground py-4">
          No active projects yet. Create a hobby and start your first project!
        </p>
      </section>
    )
  }

  const [primary, ...rest] = projects
  const secondary = rest.slice(0, 3)

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Continue</h2>
      <DashboardContinueCard project={primary} variant="primary" />
      {secondary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {secondary.map((p) => (
            <DashboardContinueCard key={p.id} project={p} variant="secondary" />
          ))}
        </div>
      )}
    </section>
  )
}
