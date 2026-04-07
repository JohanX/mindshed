import { getDashboardData } from '@/actions/dashboard'
import { DashboardContinueSection } from '@/components/dashboard/dashboard-continue-section'
import { DashboardBlockersSection } from '@/components/dashboard/dashboard-blockers-section'
import { DashboardIdleSection } from '@/components/dashboard/dashboard-idle-section'

export default async function DashboardPage() {
  const result = await getDashboardData()

  if (!result.success) {
    return (
      <main className="max-w-5xl mx-auto p-4 space-y-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">
            Something went wrong loading the dashboard. Please try again later.
          </p>
        </div>
      </main>
    )
  }

  const { recentProjects, activeBlockers, idleProjects } = result.data

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <DashboardContinueSection projects={recentProjects} />
      <DashboardBlockersSection blockers={activeBlockers} />
      <DashboardIdleSection projects={idleProjects} />
    </main>
  )
}
